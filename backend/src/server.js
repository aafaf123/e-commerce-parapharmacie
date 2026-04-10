import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import cron from 'node-cron';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// Import des routes
import categoriesRouter from './routes/categories.js';
import usersRouter from './routes/users.js';
import productsRouter from './routes/products.js';
import promoCodesRouter from './routes/promoCodes.js';
import promotionsRouter from './routes/promotions.js';
import settingsRouter from './routes/settings.js';
import uploadRouter from './routes/upload.js';
import adminRouter from './routes/admin.js';
import brandsRouter from './routes/brands.js';
import favoritesRouter from './routes/favorites.js';
import suppliersRouter from './routes/suppliers.js';
import { setIo, addClientSocket, removeClientSocket } from './io.js';

import ordersRoutes from "./routes/orders.js";
import { sendOrderConfirmation, sendOrderStatusUpdate } from "./services/emailService.js";
import { startStockNotifier } from './cron/stockNotifier.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});
const prisma = new PrismaClient();
setIo(io);

app.use(express.json());

// Middleware CORS - must be before routes
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes API
app.use("/api/orders", ordersRoutes);

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes API
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/promo-codes', promoCodesRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/brands', brandsRouter);
app.use('/api/user/favorites', favoritesRouter);
app.use('/api/admin', suppliersRouter);

// User profile routes
app.use('/api/user', usersRouter);



const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Middleware d'authentification
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ message: 'Token manquant' })
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch (error) {
    res.status(401).json({ message: 'Token invalide' })
  }
}

// Helper : créer une entrée d'audit et / ou notifier les admins
async function createAuditLog({ userId, action, entityType, entityId, oldValues = null, newValues = null, description }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        ipAddress: null,
        userAgent: null,
        description
      }
    })
  } catch (error) {
    console.error('AuditLog creation error:', error)
  }
}

// Helper : décrémenter le stock et enregistrer le mouvement
async function decrementStock(items, orderId, userId) {
  console.log(`📦 Décrément stock pour commande ${orderId}, ${items.length} articles`);
  for (const item of items) {
    // OrderItem has productId, not id
    const productId = item.productId;
    console.log(`  - Produit ID: ${productId}, quantité: ${item.quantity}`);
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, stock: true, stockAlert: true }
    })
    if (!product) {
      console.log(`  ⚠️ Produit non trouvé: ${productId}`);
      continue
    }

    const newStock = Math.max(0, product.stock - item.quantity)
    console.log(`  - ${product.name}: ${product.stock} → ${newStock}`);
    
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: newStock }
    })

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: 'SALE',
        quantity: -item.quantity,
        reason: `Commande ${orderId}`,
        userId: userId || null
      }
    })

    // Alerte stock critique via WebSocket
    if (newStock <= product.stockAlert) {
      io.to('admin_room').emit('admin_stock_alert', {
        productId: product.id,
        productName: product.name,
        stock: newStock,
        stockAlert: product.stockAlert,
        timestamp: new Date()
      })
    }
  }
  console.log(`✅ Décrément stock terminé pour commande ${orderId}`);
}

// Helper : réapprovisionner le stock (annulation/remboursement/retour)
// Only restores stock if it was previously decremented (order was confirmed)
async function restoreStock(orderId, userId, previousStatus) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { id: true, name: true, stock: true, stockAlert: true } } } } }
  })
  if (!order) return

  // Only restore stock if the order was confirmed (stock was decremented)
  // Stock is decremented at order creation (RECEIVED) or higher
  const stockWasDecremented = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED'].includes(previousStatus)
  
  if (!stockWasDecremented) {
    console.log(`Order ${order.orderNumber} was not confirmed, skipping stock restoration`)
    return
  }

  for (const item of order.items) {
    const newStock = item.product.stock + item.quantity
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: newStock }
    })

    await prisma.stockMovement.create({
      data: {
        productId: item.productId,
        type: 'RETURN',
        quantity: item.quantity,
        reason: `Annulation/Retour commande ${order.orderNumber}`,
        userId: userId || null
      }
    })
  }
}

// Routes d'authentification
// backend/src/server.js
// Modifiez la route signup (vers ligne 180)

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, password } = req.body

    // Validation
    if (!firstName || !lastName || !email || !phone || !address || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis' })
    }

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' })
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10)

    // Créer l'utilisateur avec le rôle CLIENT par défaut
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        address,
        password: hashedPassword,
        role: 'CLIENT',  // ← AJOUTER EXPLICITEMENT LE RÔLE
      },
    })

    // Générer le token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },  // ← AJOUTER role dans le token
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Notification WebSocket aux admins pour nouvel utilisateur
    io.to('admin_room').emit('admin_user_created', {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.createdAt
    })

    // Audit: nouvel utilisateur
    await createAuditLog({
      userId: user.id,
      action: 'SIGNUP',
      entityType: 'User',
      entityId: user.id,
      newValues: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      description: `Utilisateur inscrit: ${user.email}`
    })

    // Notification WebSocket admin pour connexion utilisateur
    io.to('admin_room').emit('admin_user_logged_in', {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      action: 'SIGNUP',
      timestamp: new Date()
    })

    res.status(201).json({
      message: 'Inscription réussie',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role  // ← AJOUTER LE RÔLE DANS LA RÉPONSE
      },
    })
  } catch (error) {
    console.error('Signup error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})
// backend/src/server.js
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },  // ← Ajouter role ici
      JWT_SECRET,
      { expiresIn: '7d' }
    )
     console.log('🔐 Login - User role:', user.role)  // ← AJOUTER CE LOG

    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role  // ← AJOUTER LE RÔLE DANS LA RÉPONSE
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})
// Route Google OAuth - vérifie le credential via l'API Google tokeninfo
app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body
    if (!credential) return res.status(400).json({ message: 'Credential Google manquant' })

    // Vérifier le token Google via l'API publique (sans dépendance)
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`)
    if (!googleRes.ok) return res.status(401).json({ message: 'Token Google invalide' })

    const payload = await googleRes.json()
    if (!payload.email_verified || payload.email_verified === 'false') {
      return res.status(401).json({ message: 'Email Google non vérifié' })
    }

    const { email, given_name, family_name, picture } = payload

    // Trouver ou créer l'utilisateur
    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName: given_name || 'Utilisateur',
          lastName: family_name || 'Google',
          phone: '',
          address: '',
          password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
          profileImage: picture || null,
          role: 'CLIENT',
        }
      })
    }

    if (!user.isActive) return res.status(403).json({ message: 'Compte désactivé' })

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

    res.json({
      message: 'Connexion Google réussie',
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
    })
  } catch (error) {
    console.error('Google auth error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Route pour demander la réinitialisation du mot de passe
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email requis' })
    }

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' })
    }

    // Générer un token unique
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Sauvegarder le token dans la base de données
    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    // Note: Email notifications have been removed
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`

    res.json({ message: 'Demande de réinitialisation traitée avec succès' })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Route pour réinitialiser le mot de passe
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ message: 'Token et mot de passe requis' })
    }

    // Trouver l'utilisateur avec le token valide
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      return res.status(400).json({ message: 'Token invalide ou expiré' })
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 10)

    // Mettre à jour le mot de passe et supprimer le token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    })

    res.json({ message: 'Mot de passe réinitialisé avec succès' })
  } catch (error) {
    console.error('Reset password error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Route pour récupérer le profil utilisateur
app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        profileImage: true,
        notificationEmail: true,
        notificationSMS: true,
        notificationPush: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' })
    }

    res.json(user)
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Route pour mettre à jour le profil utilisateur
app.put('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, address, profileImage, notificationEmail, notificationSMS, notificationPush } = req.body

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(profileImage !== undefined && { profileImage: profileImage || null }),
        ...(notificationEmail !== undefined && { notificationEmail }),
        ...(notificationSMS !== undefined && { notificationSMS }),
        ...(notificationPush !== undefined && { notificationPush }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        profileImage: true,
        notificationEmail: true,
        notificationSMS: true,
        notificationPush: true,
      },
    })

    res.json({
      message: 'Profil mis à jour avec succès',
      user,
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Route pour sauvegarder le panier
app.post('/api/user/cart', verifyToken, async (req, res) => {
  try {
    const { cart } = req.body

    await prisma.user.update({
      where: { id: req.userId },
      data: { cart },
    })

    res.json({ message: 'Panier sauvegardé' })
  } catch (error) {
    console.error('Save cart error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Route pour récupérer le panier
app.get('/api/user/cart', verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { cart: true },
    })

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' })
    }

    res.json({ cart: user.cart || [] })
  } catch (error) {
    console.error('Get cart error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Routes pour les commandes Click & Collect
app.post('/api/orders/create', async (req, res) => {
  try {
    const { items, total, timeSlot, orderNumber, type, deliveryAddress } = req.body
    const token = req.headers.authorization?.split(' ')[1]

    // Exiger un token valide pour créer une commande
    if (!token) {
      return res.status(401).json({ message: 'Vous devez être connecté pour créer une commande' })
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      console.error('Token verification failed:', error.message)
      return res.status(401).json({ message: 'Token invalide ou expiré. Veuillez vous reconnecter.' })
    }

    const userId = decoded.id
    console.log('Creating order for userId:', userId)

    // Normaliser la date du créneau en UTC pour éviter les décalages
    let slotDate = null;
    if (timeSlot?.date) {
      const dateStr = new Date(timeSlot.date).toISOString().slice(0, 10);
      slotDate = new Date(dateStr + 'T00:00:00.000Z');
    }

    // ── Règle 2 : Vérification du stock avant création ──
    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.id },
        select: { id: true, name: true, stock: true }
      })
      if (!product) {
        return res.status(400).json({
          message: `Produit introuvable : ${item.id}`,
          code: 'PRODUCT_NOT_FOUND'
        })
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Stock insuffisant pour "${product.name}". Il ne reste que ${product.stock} unité(s) disponible(s).`,
          code: 'INSUFFICIENT_STOCK',
          productId: product.id,
          productName: product.name,
          available: product.stock,
          requested: item.quantity
        })
      }
    }

    // ── Validation atomique du créneau (si créneau sélectionné) ──
    if (slotDate && timeSlot?.slot?.time) {
      const dateStr = slotDate.toISOString().slice(0, 10)  // YYYY-MM-DD UTC
      const slotTime = timeSlot.slot.time
      const dayOfWeek = slotDate.getUTCDay()

      // Capacité : override spécifique > config du jour > défaut
      const override = await prisma.slotCapacityOverride.findUnique({
        where: { dayOfWeek_slotTime: { dayOfWeek, slotTime } }
      })
      let slotCapacity = 5
      if (override) {
        slotCapacity = override.capacity
      } else {
        const configs = await prisma.timeSlotConfig.findMany({
          where: { dayOfWeek, active: true },
          orderBy: { startTime: 'asc' }
        })
        if (configs.length > 0) {
          const matching = configs.find(c => slotTime >= c.startTime && slotTime < c.endTime)
          if (matching) slotCapacity = matching.capacity
        }
      }

      // Compter les réservations actives avec plage UTC
      const slotDateStart = new Date(dateStr + 'T00:00:00.000Z');
      const slotDateEnd   = new Date(dateStr + 'T23:59:59.999Z');
      const existingCount = await prisma.order.count({
        where: {
          timeSlotDate: { gte: slotDateStart, lte: slotDateEnd },
          timeSlotStart: slotTime,
          status: { notIn: ['CANCELLED', 'COMPLETED'] }
        }
      })

      if (existingCount >= slotCapacity) {
        return res.status(409).json({
          message: 'Ce créneau est complet. Veuillez en choisir un autre.',
          code: 'SLOT_FULL'
        })
      }
    }

    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber,
        type,
        total,
        timeSlotDate: slotDate,
        timeSlotStart: timeSlot?.slot?.time || null,
        timeSlotEnd: timeSlot?.slot?.endTime || null,
        deliveryAddress: deliveryAddress || null,
        status: 'RECEIVED',
        items: {
          create: items.map(item => ({
            productId: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        }
      },
    })

    // Debug: Log the created order's time slot info
    console.log('Order created:', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      timeSlotDate: order.timeSlotDate,
      timeSlotStart: order.timeSlotStart,
      timeSlotEnd: order.timeSlotEnd,
      status: order.status
    })

    // Décrémenter le stock à la création de la commande
    await decrementStock(order.items, order.id, userId)

    // Notification WebSocket au client
    if (userId) {
      io.to(`user_${userId}`).emit('notification', {
        type: 'ORDER_CREATED',
        title: 'Commande créée',
        message: `Votre commande ${orderNumber} a été créée avec succès`,
        orderId: order.id,
        timestamp: new Date()
      })
    }

    // Notification WebSocket aux admins
    io.to('admin_room').emit('admin_new_order', {
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      total: order.total,
      status: order.status,
      customerName: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Client anonyme',
      customerEmail: order.user?.email,
      customerPhone: order.user?.phone,
      timeSlotDate: order.timeSlotDate,
      timeSlotStart: order.timeSlotStart,
      timeSlotEnd: order.timeSlotEnd,
      itemsCount: order.items.length,
      createdAt: order.createdAt
    })

    // Audit: création de commande client
    if (userId) {
      await createAuditLog({
        userId,
        action: 'CREATE',
        entityType: 'Order',
        entityId: order.id,
        newValues: {
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.total,
          type: order.type
        },
        description: `Commande créée par l'utilisateur ${order.user?.email || order.userId}: ${order.orderNumber}`
      })
    }

    // ← FIX AUTO EMAIL ON ORDER CREATE
    if (order.user?.email && order.user.notificationEmail !== false) {
      try {
        await sendOrderConfirmation(order.user.email, {
          orderNumber: order.orderNumber,
          total: order.total,
          timeSlotDate: order.timeSlotDate,
          timeSlotStart: order.timeSlotStart,
          timeSlotEnd: order.timeSlotEnd,
          status: order.status,
          createdAt: order.createdAt,
          user: order.user
        })
        console.log(`✅ AUTO Email confirmation sent for ${order.orderNumber} to ${order.user.email}`)
      } catch (emailErr) {
        console.error(`❌ AUTO Email failed for ${order.orderNumber}:`, emailErr)
      }
    }

    res.status(201).json({
      message: 'Commande créée avec succès',
      order,
    })
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

app.post('/api/orders/send-confirmation', async (req, res) => {
  try {
    const { orderNumber, timeSlot, qrCode } = req.body
    const token = req.headers.authorization?.split(' ')[1]
    let userEmail = null

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET)
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { email: true, firstName: true, lastName: true },
        })
        if (user) {
          userEmail = user.email

          // Trouver la commande par orderNumber (pour l'email uniquement)
          const order = await prisma.order.findFirst({
            where: { orderNumber },
          })

          // NOTE: Le stock est déduit par l'admin lors du passage à PREPARING
          // Pas de déduction ici pour éviter la double déduction
          if (order && order.status === 'RECEIVED') {
            // Le stock a déjà été décrémenté à la création de la commande
            // Mettre à jour le statut de la commande à PREPARING
            await prisma.order.update({
              where: { id: order.id },
              data: { status: 'PREPARING' }
            })
          }

          const slotDate = new Date(timeSlot.date)
          const formattedDate = slotDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

          // Envoyer notification WebSocket aux admins de confirmation de commande
          io.to('admin_room').emit('admin_order_confirmed', {
            orderNumber,
            customerName: `${user.firstName} ${user.lastName}`,
            customerEmail: user.email,
            timeSlot: `${formattedDate} ${timeSlot.slot.time} - ${timeSlot.slot.endTime}`,
            qrCode,
            confirmedAt: new Date(),
          })

          // Audit: confirmation de commande côté client
          await createAuditLog({
            userId: user.id,
            action: 'CONFIRM',
            entityType: 'Order',
            entityId: orderNumber,
            newValues: {
              orderNumber,
              timeSlot,
              qrCode
            },
            description: `Commande confirmée par le client ${user.email} : ${orderNumber}`
          })
        }
      } catch (error) {
        console.log('Confirmation error:', error)
      }
    }

    res.json({ message: 'Email envoyé' })
  } catch (error) {
    console.error('Send confirmation error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})

// Récupérer les commandes de l'utilisateur
app.get('/api/orders/my-orders', verifyToken, async (req, res) => {
  try {
    console.log('🔍 Fetching orders for userId:', req.userId)
    
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`📦 Found ${orders.length} orders for userId ${req.userId}`)
    res.json({ orders })
  } catch (error) {
    console.error('Get orders error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Annuler une commande (client)
app.put('/api/orders/:orderId/cancel', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: req.userId
      },
      include: { user: true }
    })

    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' })
    }

    // Allow cancellation for RECEIVED, PREPARING, and READY statuses
    if (!['RECEIVED', 'PREPARING', 'READY'].includes(order.status)) {
      return res.status(400).json({ message: 'Cette commande ne peut plus être annulée' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' }
    })

    // Réapprovisionner le stock (only if it was decremented)
    await restoreStock(orderId, req.userId, order.status)

    // Notification WebSocket au client
    io.to(`user_${req.userId}`).emit('notification', {
      type: 'ORDER_CANCELLED',
      title: 'Commande annulée',
      message: `Votre commande ${order.orderNumber} a été annulée`,
      orderId: order.id,
      timestamp: new Date()
    })

    // Notification WebSocket aux admins
    io.to('admin_room').emit('admin_order_cancelled', {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      customerName: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Client anonyme',
      total: updatedOrder.total,
      cancelledAt: new Date()
    })

    // Audit: annulation de commande client
    if (order.userId) {
      await createAuditLog({
        userId: order.userId,
        action: 'CANCEL',
        entityType: 'Order',
        entityId: updatedOrder.id,
        oldValues: { status: 'RECEIVED' },
        newValues: { status: 'CANCELLED' },
        description: `Commande annulée par l'utilisateur ${order.user?.email || order.userId}: ${order.orderNumber}`
      })
    }

    res.json({ message: 'Commande annulée', order: updatedOrder })
  } catch (error) {
    console.error('Cancel order error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Modifier le créneau de retrait d'une commande
app.put('/api/orders/:orderId/change-timeslot', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params
    const { timeSlotDate, timeSlotStart, timeSlotEnd } = req.body

    if (!timeSlotDate || !timeSlotStart) {
      return res.status(400).json({ message: 'Date et heure de début requises' })
    }

    // Vérifier que la commande appartient à l'utilisateur
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: req.userId
      },
      include: { user: true }
    })

    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' })
    }

    // Vérifier que la commande est toujours au statut RECEIVED (peut être modifiée)
    if (order.status !== 'RECEIVED') {
      return res.status(400).json({ message: 'Cette commande ne peut plus être modifiée' })
    }

    // Vérifier que le nouveau créneau n'est pas dans le passé
    const newPickupDateTime = new Date(timeSlotDate)
    const [hours, minutes] = timeSlotStart.split(':').map(Number)
    newPickupDateTime.setHours(hours, minutes, 0, 0)
    
    const now = new Date()
    if (newPickupDateTime < now) {
      return res.status(400).json({ message: 'Le créneau sélectionné est déjà passé' })
    }

    // Vérifier la disponibilité du nouveau créneau
    const blockedSlot = await prisma.blockedSlot.findFirst({
      where: {
        date: timeSlotDate,
        active: true,
        OR: [
          { startTime: null }, // Journée entière bloquée
          { 
            AND: [
              { startTime: { not: null } },
              { endTime: { not: null } },
              { startTime: { lte: timeSlotStart } },
              { endTime: { gte: timeSlotEnd || timeSlotStart } }
            ]
          }
        ]
      }
    })

    if (blockedSlot) {
      return res.status(400).json({ message: 'Ce créneau n\'est pas disponible' })
    }

    // Mettre à jour le créneau
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        timeSlotDate: new Date(timeSlotDate),
        timeSlotStart,
        timeSlotEnd: timeSlotEnd || timeSlotStart
      },
      include: { user: true }
    })

    // Notification WebSocket au client
    io.to(`user_${req.userId}`).emit('notification', {
      type: 'ORDER_TIMESLOT_CHANGED',
      title: 'Créneau modifié',
      message: `Votre créneau de retrait pour la commande ${order.orderNumber} a été modifié`,
      orderId: order.id,
      newTimeSlot: { timeSlotDate, timeSlotStart, timeSlotEnd: timeSlotEnd || timeSlotStart },
      timestamp: new Date()
    })

    // Notification WebSocket aux admins
    io.to('admin_room').emit('admin_order_timeslot_changed', {
      id: updatedOrder.id,
      orderNumber: order.orderNumber,
      oldTimeSlot: { 
        timeSlotDate: order.timeSlotDate, 
        timeSlotStart: order.timeSlotStart, 
        timeSlotEnd: order.timeSlotEnd 
      },
      newTimeSlot: { timeSlotDate, timeSlotStart, timeSlotEnd: timeSlotEnd || timeSlotStart },
      customerId: req.userId,
      timestamp: new Date()
    })

    res.json({ 
      message: 'Créneau de retrait modifié avec succès', 
      order: updatedOrder 
    })
  } catch (error) {
    console.error('Change timeslot error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Mettre à jour le statut d'une commande (admin)
app.put('/api/orders/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params
    const { status } = req.body

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true }
    })

    if (!order) {
      return res.status(404).json({ message: 'Commande non trouvée' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status }
    })

    // ── Règle 1 : Déduction automatique du stock quand l'admin confirme (RECEIVED → PREPARING) ──
    if (status === 'PREPARING' && order.status === 'RECEIVED') {
      const fullOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      })
      if (fullOrder) {
        await decrementStock(fullOrder.items, fullOrder.orderNumber, null)
      }
    }

    // Réapprovisionner le stock si annulation, remboursement ou retour
    if ((status === 'CANCELLED' || status === 'REFUNDED' || status === 'RETURNED') && 
        order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && order.status !== 'RETURNED') {
      await restoreStock(orderId, null, order.status)
    }

    // Notification WebSocket au client
    if (order.userId) {
      const statusMessages = {
        RECEIVED: 'Commande reçue',
        PREPARING: 'Commande en préparation',
        READY: 'Commande prête',
        COMPLETED: 'Commande récupérée'
      }
      io.to(`user_${order.userId}`).emit('notification', {
        type: 'ORDER_STATUS_CHANGED',
        title: statusMessages[status] || 'Mise à jour',
        message: `Votre commande ${order.orderNumber} : ${statusMessages[status]}`,
        orderId: order.id,
        status: status,
        timestamp: new Date()
      })

      // Envoyer email de mise à jour de statut si l'utilisateur a un email
      if (order.user?.email && order.user.notificationEmail !== false) {
        await sendOrderStatusUpdate(order.user.email, order, status);
      }
    }

    // Notification WebSocket aux admins
    io.to('admin_room').emit('admin_order_status_changed', {
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: status,
      customerName: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Client anonyme',
      customerEmail: order.user?.email,
      total: updatedOrder.total,
      timeSlotDate: updatedOrder.timeSlotDate,
      timeSlotStart: updatedOrder.timeSlotStart,
      updatedAt: new Date()
    })

    // Audit: changement de statut de commande
    await createAuditLog({
      userId: req.userId || order.userId || 'unknown',
      action: 'UPDATE',
      entityType: 'Order',
      entityId: updatedOrder.id,
      oldValues: { status: order.status },
      newValues: { status },
      description: `Statut de commande ${order.orderNumber} changé de ${order.status} à ${status}`
    })

    res.json({ message: 'Statut mis à jour', order: updatedOrder })
  } catch (error) {
    console.error('Update status error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// backend/src/server.js
// Ajoutez cette route APRÈS les autres routes, avant app.listen

// ============ ROUTES PUBLIQUES POUR LES CRÉNEAUX ============

// GET /api/time-slots/available - Récupérer les créneaux disponibles (public)
app.get('/api/time-slots/available', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date requise' });

    console.log(`[TimeSlots] ====== FETCHING SLOTS ======`);
    console.log(`[TimeSlots] Query date param: ${date}`);
    
    // Normaliser la date : on utilise la date telle quelle en UTC
    // La date envoyée par le frontend est déjà au format YYYY-MM-DD
    const targetDateStart = new Date(date + 'T00:00:00.000Z');
    const targetDateEnd   = new Date(date + 'T23:59:59.999Z');
    const dayOfWeek = targetDateStart.getUTCDay();
    
    console.log(`[TimeSlots] targetDateStart: ${targetDateStart.toISOString()}`);
    console.log(`[TimeSlots] targetDateEnd: ${targetDateEnd.toISOString()}`);
    console.log(`[TimeSlots] dayOfWeek: ${dayOfWeek}`);

    // Créneaux bloqués actifs
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: { active: true }
    });

    // Vérifier si la journée entière est bloquée via BlockedSlot
    const isDayBlocked = blockedSlots.some(b => {
      const bDate = b.date.toISOString().slice(0, 10);
      return bDate === date && !b.startTime;
    });
    if (isDayBlocked) return res.json([]);

    // Vérifier si le jour de la semaine est désactivé via TimeSlotConfig
    // Un jour est désactivé si aucune config n'existe OU si toutes les configs sont inactives
    const allDayConfigs = await prisma.timeSlotConfig.findMany({ where: { dayOfWeek } });
    
    // Si aucune config n'existe pour ce jour, il est considéré comme fermé
    if (allDayConfigs.length === 0) {
      return res.json([]);
    }
    
    const hasActiveConfig = allDayConfigs.some(c => c.active);
    
    // Si toutes les configs sont inactives, le jour est fermé
    if (!hasActiveConfig) {
      return res.json([]);
    }

    // Récupérer config admin active si elle existe (réutiliser allDayConfigs)
    const configs = allDayConfigs.filter(c => c.active).sort((a, b) => a.startTime.localeCompare(b.startTime));

    const slots = configs.map(c => ({ startTime: c.startTime, endTime: c.endTime, intervalMinutes: c.intervalMinutes, capacity: c.capacity }));

    // Commandes existantes pour cette date (plage UTC pour éviter les décalages)
    const existingOrders = await prisma.order.findMany({
      where: {
        timeSlotDate: { gte: targetDateStart, lte: targetDateEnd },
        timeSlotStart: { not: null },
        status: { notIn: ['CANCELLED', 'COMPLETED'] }
      },
      select: { timeSlotStart: true }
    });
    
    // Debug logging
    console.log(`[TimeSlots] Date: ${date}, Found ${existingOrders.length} orders for this date`);
    console.log(`[TimeSlots] Orders: ${JSON.stringify(existingOrders.map(o => o.timeSlotStart))}`);
    
    const reservationsCount = {};
    existingOrders.forEach(o => {
      // Normalize time format to HH:MM
      const timeKey = o.timeSlotStart ? o.timeSlotStart.trim() : null;
      if (timeKey) {
        reservationsCount[timeKey] = (reservationsCount[timeKey] || 0) + 1;
      }
    });
    
    console.log(`[TimeSlots] Reservations count: ${JSON.stringify(reservationsCount)}`);

    // Overrides de capacité par créneau pour ce jour
    const overrides = await prisma.slotCapacityOverride.findMany({ where: { dayOfWeek } });
    const overrideMap = {};
    overrides.forEach(o => { overrideMap[o.slotTime] = o.capacity; });

    // ── Filtre temporel : ne jamais afficher un créneau déjà passé ──
    // Les heures de config (startTime/endTime) sont en heure Maroc (UTC+1)
    // On compare directement en minutes Maroc sans conversion UTC
    const nowUTC = new Date();
    const nowMorocco = new Date(nowUTC.getTime() + 60 * 60 * 1000); // UTC+1
    const todayMorocco = nowMorocco.toISOString().slice(0, 10);
    const isToday = (date === todayMorocco);
    // Heure actuelle Maroc en minutes + marge 30 min
    const nowMoroccoMinutes = isToday
      ? nowMorocco.getUTCHours() * 60 + nowMorocco.getUTCMinutes() + 30
      : 0;

    // Helper : convertit "HH:MM" en minutes depuis minuit
    const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    // Helper : convertit des minutes en "HH:MM"
    const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    const availableSlots = [];
    for (const cfg of slots) {
      // Les heures de config sont en heure Maroc — on travaille directement en minutes
      const startMin = toMinutes(cfg.startTime);
      const endMin   = toMinutes(cfg.endTime);
      const step     = cfg.intervalMinutes;

      for (let cur = startMin; cur < endMin; cur += step) {
        const timeStr = toHHMM(cur);
        const endStr  = toHHMM(cur + step);

        // Filtrer les créneaux passés pour aujourd'hui
        if (isToday && cur < nowMoroccoMinutes) continue;

        // Vérifier blocage horaire
        // Les blockedSlots.startTime/endTime sont aussi en heure Maroc
        const isBlocked = blockedSlots.some(b => {
          const bDate = b.date.toISOString().slice(0, 10);
          if (bDate !== date || !b.startTime) return false;
          const bStart = toMinutes(b.startTime);
          const bEnd   = b.endTime ? toMinutes(b.endTime) : 24 * 60;
          return cur >= bStart && cur < bEnd;
        });
        if (isBlocked) continue;

        const slotCapacity = overrideMap[timeStr] !== undefined ? overrideMap[timeStr] : cfg.capacity;
        const reservations = reservationsCount[timeStr] || 0;
        availableSlots.push({
          time: timeStr,
          endTime: endStr,
          capacity: slotCapacity,
          reservations,
          available: reservations < slotCapacity
        });
      }
    }

    res.json(availableSlots);
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/time-slots/config - Récupérer la configuration (public)
app.get('/api/time-slots/config', async (req, res) => {
  try {
    const configs = await prisma.timeSlotConfig.findMany({
      where: { active: true },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });
    res.json(configs);
  } catch (error) {
    console.error('Get time slot config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/time-slots/blocked - Récupérer les créneaux bloqués (public)
app.get('/api/time-slots/blocked', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = { active: true };
    
    if (startDate) {
      where.date = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.date = { ...where.date, lte: new Date(endDate) };
    }
    
    const blockedSlots = await prisma.blockedSlot.findMany({
      where,
      orderBy: { date: 'asc' }
    });
    res.json(blockedSlots);
  } catch (error) {
    console.error('Get blocked slots error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ============ ROUTES PUBLIQUES POUR LES AVIS ============

// GET /api/reviews/:productId - Avis approuvés d'un produit
app.get('/api/reviews/:productId', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId: req.params.productId, approved: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/reviews/:productId - Soumettre un avis (en attente de modération)
app.post('/api/reviews/:productId', verifyToken, async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) {
      return res.status(400).json({ message: 'Nom, note et commentaire requis' });
    }
    const review = await prisma.review.create({
      data: {
        productId: req.params.productId,
        userId: req.userId,
        name,
        rating: parseInt(rating),
        comment,
        approved: false
      }
    });
    res.status(201).json({ message: 'Avis soumis, en attente de modération', review });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});
// Start stock notifications cron
startStockNotifier(io);

// Démarrer le serveur
const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`)
  console.log(`🔌 WebSocket activé sur ws://localhost:${PORT}`)
  console.log('🔔 Stock notifier actif (check toutes 5 min)')
})
// WebSocket - Gestion des connexions
io.on('connection', (socket) => {
  console.log('👤 Client connecté:', socket.id)

  // Authentification pour les clients
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      socket.userId = decoded.id
      socket.userType = 'client'
      socket.join(`user_${decoded.id}`)
      // Track this socket for plain-JSON broadcasts
      addClientSocket(socket)
      console.log(`✅ Client ${decoded.id} authentifié`)
    } catch (error) {
      console.error('❌ Erreur authentification WebSocket client:', error)
    }
  })

  // Authentification pour les admins
 // Dans server.js, modifiez la partie admin_authenticate
socket.on('admin_authenticate', (adminToken) => {
  console.log('🔐 AdminWebSocket - Tentative authentification avec token');
  try {
    const decoded = jwt.verify(adminToken, JWT_SECRET);
    console.log('🔐 AdminWebSocket - Token décodé pour ID:', decoded.id, 'role:', decoded.role);
    
    // Vérifier user existe et rôle admin
    prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true, isActive: true }
    }).then(user => {
      if (user && (user.role === 'ADMIN' || user.role === 'CAISSIER' || user.role === 'PREPARATEUR') && user.isActive) {
        socket.adminId = decoded.id;
        socket.adminRole = user.role;
        socket.userType = 'admin';
        socket.join('admin_room');
        console.log(`✅ AdminWebSocket - Admin ${decoded.id} (${user.role}) authentifié`);
        socket.emit('admin_authenticated', { success: true, role: user.role });
      } else {
        console.log(`❌ AdminWebSocket - Accès refusé pour ${decoded.id} (role: ${decoded.role || 'unknown'})`);
        socket.emit('admin_authenticated', { success: false, error: 'Accès refusé' });
      }
    }).catch(error => {
      console.error('❌ AdminWebSocket - Erreur vérification admin:', error);
      socket.emit('admin_authenticated', { success: false, error: 'Erreur serveur' });
    });
  } catch (error) {
    console.error('❌ AdminWebSocket - Token invalide:', error.message);
    socket.emit('admin_authenticated', { success: false, error: 'Token invalide' });
  }
});

  socket.on('disconnect', () => {
    removeClientSocket(socket)
    if (socket.adminId) {
      console.log(`👋 Admin ${socket.adminId} déconnecté`)
    } else if (socket.userId) {
      console.log(`👋 Client ${socket.userId} déconnecté`)
    } else {
      console.log(`👋 Socket ${socket.id} déconnecté`)
    }
  })
})

// Tâche cron pour les rappels automatiques (toutes les 15 minutes)
cron.schedule('*/15 * * * *', async () => {
  try {
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)

    // Trouver les commandes dont le créneau est dans 2h et qui n'ont pas reçu de rappel
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
        reminderSent: false,
        timeSlotDate: {
          gte: now,
          lte: twoHoursLater,
        },
      },
      include: {
        user: true,
      },
    })

    for (const order of orders) {
      // Marquer la commande comme urgente
      if (!order.isUrgent) {
        await prisma.order.update({
          where: { id: order.id },
          data: { isUrgent: true }
        })
        
        // Notification WebSocket au client pour commande urgente
        if (order.userId) {
          io.to(`user_${order.userId}`).emit('notification', {
            type: 'ORDER_URGENT',
            title: '⚡ Commande urgente',
            message: `Votre commande ${order.orderNumber} doit être retirée dans moins de 2 heures`,
            orderId: order.id,
            isUrgent: true,
            timestamp: new Date()
          })
        }
        
        // Notification WebSocket aux admins pour commande urgente
        io.to('admin_room').emit('admin_urgent_order', {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.user ? `${order.user.firstName} ${order.user.lastName}` : 'Client anonyme',
          customerPhone: order.user?.phone,
          timeSlotDate: order.timeSlotDate,
          timeSlotStart: order.timeSlotStart,
          timeSlotEnd: order.timeSlotEnd,
          status: order.status,
          isUrgent: true,
          urgentReason: 'Retrait dans moins de 2 heures',
          timestamp: new Date()
        })
      }
      
      // Note: Email reminders have been removed
    }
  } catch (error) {
    console.error('Cron reminder error:', error)
  }
})
