import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import cron from 'node-cron';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

// Import des routes
import categoriesRouter from './routes/categories.js';
import productsRouter from './routes/products.js';
import promoCodesRouter from './routes/promoCodes.js';
import promotionsRouter from './routes/promotions.js';
import settingsRouter from './routes/settings.js';
import uploadRouter from './routes/upload.js';
import adminRouter from './routes/admin.js';
import brandsRouter from './routes/brands.js';
import favoritesRouter from './routes/favorites.js';

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

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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


const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// Configuration Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

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

// Routes d'authentification
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

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        address,
        password: hashedPassword,
      },
    })

    // Générer le token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
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

    // Envoyer l'email
    const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <h2>Réinitialisation de mot de passe</h2>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <a href="${resetLink}">Réinitialiser mon mot de passe</a>
        <p>Ce lien expire dans 15 minutes.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
      `,
    })

    res.json({ message: 'Email de réinitialisation envoyé' })
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
        ...(profileImage && { profileImage }),
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
    const { items, total, timeSlot, orderNumber, type } = req.body
    const token = req.headers.authorization?.split(' ')[1]
    let userId = null

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET)
        userId = decoded.id
      } catch (error) {
        console.log('Token invalid, creating guest order')
      }
    }

    const slotDate = new Date(timeSlot.date)

    const order = await prisma.order.create({
      data: {
        userId,
        orderNumber,
        type,
        total,
        timeSlotDate: slotDate,
        timeSlotStart: timeSlot.slot.time,
        timeSlotEnd: timeSlot.slot.endTime,
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

    // Envoyer notification de création
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user && user.notificationEmail) {
        await sendStatusNotification(user, order, 'RECEIVED')
      }
      // Notification WebSocket au client
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

          const slotDate = new Date(timeSlot.date)
          const formattedDate = slotDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })

          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userEmail,
            subject: `Confirmation Click & Collect - ${orderNumber}`,
            html: `
              <h2>🎉 Commande confirmée !</h2>
              <p>Bonjour ${user.firstName},</p>
              <p>Votre commande Click & Collect est confirmée.</p>
              <h3>Détails du retrait :</h3>
              <ul>
                <li><strong>Numéro de commande :</strong> ${orderNumber}</li>
                <li><strong>Date :</strong> ${formattedDate}</li>
                <li><strong>Créneau :</strong> ${timeSlot.slot.time} - ${timeSlot.slot.endTime}</li>
                <li><strong>Lieu :</strong> Pharmacie ParaClick, 123 Avenue de la République, Alger</li>
              </ul>
              <p><strong>Paiement au comptoir lors du retrait</strong></p>
              <p>Vous recevrez un rappel 2 heures avant votre créneau.</p>
              <p>Présentez votre QR code en pharmacie.</p>
              <br>
              <p>À bientôt !</p>
            `,
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
        console.log('Email sending failed:', error)
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

    res.json({ orders })
  } catch (error) {
    console.error('Get orders error:', error)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Annuler une commande
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

    if (order.status !== 'RECEIVED') {
      return res.status(400).json({ message: 'Cette commande ne peut plus être annulée' })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' }
    })

    // Envoyer notification d'annulation
    if (order.user && order.user.notificationEmail) {
      await sendStatusNotification(order.user, updatedOrder, 'CANCELLED')
    }
    
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

    // Envoyer notification de changement de statut
    if (order.user && order.user.notificationEmail) {
      await sendStatusNotification(order.user, updatedOrder, status)
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

// Fonction pour envoyer les notifications de statut
async function sendStatusNotification(user, order, status) {
  const statusMessages = {
    RECEIVED: {
      subject: '✅ Commande reçue',
      title: 'Commande reçue !',
      message: 'Nous avons bien reçu votre commande et nous la préparons.'
    },
    PREPARING: {
      subject: '⏳ Commande en préparation',
      title: 'Commande en préparation',
      message: 'Votre commande est actuellement en cours de préparation.'
    },
    READY: {
      subject: '🎉 Commande prête',
      title: 'Commande prête !',
      message: 'Votre commande est prête à être retirée. Rendez-vous en pharmacie avec votre QR code.'
    },
    COMPLETED: {
      subject: '✨ Commande récupérée',
      title: 'Merci pour votre visite !',
      message: 'Votre commande a été récupérée avec succès. À bientôt !'
    },
    CANCELLED: {
      subject: '❌ Commande annulée',
      title: 'Commande annulée',
      message: 'Votre commande a été annulée comme demandé.'
    }
  }

  const statusInfo = statusMessages[status] || statusMessages.RECEIVED

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `${statusInfo.subject} - ${order.orderNumber}`,
      html: `
        <h2>${statusInfo.title}</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>${statusInfo.message}</p>
        <h3>Détails de la commande :</h3>
        <ul>
          <li><strong>Numéro :</strong> ${order.orderNumber}</li>
          <li><strong>Montant :</strong> ${order.total.toFixed(2)} DA</li>
          ${order.timeSlotDate ? `<li><strong>Retrait prévu :</strong> ${new Date(order.timeSlotDate).toLocaleDateString('fr-FR')} à ${order.timeSlotStart}</li>` : ''}
        </ul>
        <p>Cordialement,<br>L'équipe ParaClick</p>
      `
    })
  } catch (error) {
    console.error('Error sending status notification:', error)
  }
}

// Démarrer le serveur
const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`)
  console.log(`🔌 WebSocket activé sur ws://localhost:${PORT}`)
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
    console.log('🔐 AdminWebSocket - Token décodé pour ID:', decoded.id);
    
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
        
        // ENVOYER UNE RÉPONSE DE SUCCÈS
        socket.emit('admin_authenticated', { success: true, role: user.role });
      } else {
        console.log(`❌ AdminWebSocket - Accès refusé pour ${decoded.id}`);
        socket.emit('admin_authenticated', { success: false, error: 'Accès refusé' });
      }
    }).catch(error => {
      console.error('❌ AdminWebSocket - Erreur vérification admin:', error);
      socket.emit('admin_authenticated', { success: false, error: 'Erreur serveur' });
    });
  } catch (error) {
    console.error('❌ AdminWebSocket - Token invalide:', error);
    socket.emit('admin_authenticated', { success: false, error: 'Token invalide' });
  }
});

  socket.on('disconnect', () => {
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
      if (order.user && order.user.email && order.user.notificationEmail) {
        // Envoyer email de rappel
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: order.user.email,
          subject: `⏰ Rappel - Retrait dans 2h - ${order.orderNumber}`,
          html: `
            <h2>🔔 Rappel de retrait</h2>
            <p>Bonjour ${order.user.firstName},</p>
            <p>Votre commande Click & Collect est prête à être retirée dans 2 heures.</p>
            <h3>Détails :</h3>
            <ul>
              <li><strong>Numéro :</strong> ${order.orderNumber}</li>
              <li><strong>Créneau :</strong> ${order.timeSlotStart} - ${order.timeSlotEnd}</li>
              <li><strong>Lieu :</strong> Pharmacie ParaClick, 123 Avenue Mohammed V, Casablanca</li>
            </ul>
            <p>N'oubliez pas votre QR code !</p>
          `,
        })

        // Marquer le rappel comme envoyé
        await prisma.order.update({
          where: { id: order.id },
          data: { reminderSent: true },
        })

        console.log(`Rappel envoyé pour la commande ${order.orderNumber}`)
      }
    }
  } catch (error) {
    console.error('Cron reminder error:', error)
  }
})
