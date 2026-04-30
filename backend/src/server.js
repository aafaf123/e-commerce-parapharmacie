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
import { OAuth2Client } from 'google-auth-library';
dotenv.config();

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
import variantTypesRouter from './routes/variantTypes.js';
import favoritesRouter from './routes/favorites.js';
import suppliersRouter from './routes/suppliers.js';
import barcodeRouter from './routes/barcode.js';
import authRouter from './routes/auth.js';
import secureAuthRouter from './routes/secureAuth.js';
import timeSlotsRouter from './routes/timeSlots.js';
import deliveryRouter from './routes/delivery.js';
import offlineRouter from './routes/offline.js';
import { trackOfflineData } from './middleware/offlineTracker.js';
import { setIo, addClientSocket, removeClientSocket } from './io.js';

import ordersRoutes from "./routes/orders.js";
import { sendOrderConfirmation, sendOrderStatusUpdate, sendPasswordResetEmail, sendReminderEmail } from "./services/emailService.js";
import { initWhatsAppClient, sendWhatsAppOrderNotification } from "./services/whatsappService.js";
import { startStockNotifier } from './cron/stockNotifier.js';
import { startBackupCron } from './cron/backupDb.js';

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
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true
}));

// En-têtes pour Google OAuth
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes API
app.use("/api/orders", ordersRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/categories', trackOfflineData, categoriesRouter);
app.use('/api/admin/categories', categoriesRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/products', trackOfflineData, productsRouter);
app.use('/api/promo-codes', promoCodesRouter);
app.use('/api/promotions', promotionsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/brands', brandsRouter);
app.use('/api/admin/variant-types', variantTypesRouter);
app.use('/api/variant-types', variantTypesRouter);
app.use('/api/user/favorites', favoritesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/admin', suppliersRouter);
app.use('/api/auth', authRouter);
app.use('/api/auth', secureAuthRouter);
app.use('/api/user', usersRouter);
app.use('/api/barcode', barcodeRouter);
app.use('/api/time-slots', timeSlotsRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/offline', offlineRouter);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const GOOGLE_CLIENT_ID = '1024523760942-q8q2qqeujam35kcdcvv09vk79d6lm0ho.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Middleware d'authentification
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalide' });
  }
};

// Middleware verifyAdmin
const verifyAdminLocal = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    if (decoded.role !== 'ADMIN' && decoded.role !== 'EMPLOYE') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalide' });
  }
};

// Routes employees dans server.js supprimées — gérées par admin.js

// Helper functions
async function createAuditLog({ userId, action, entityType, entityId, oldValues = null, newValues = null, description }) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entityType, entityId, oldValues, newValues, ipAddress: null, userAgent: null, description } });
  } catch (error) { console.error('AuditLog creation error:', error); }
}

async function decrementStock(items, orderId, userId) {
  console.log(`📦 Décrément stock pour commande ${orderId}, ${items.length} articles`);
  for (const item of items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { id: true, name: true, stock: true, stockAlert: true } });
    if (!product) continue;
    const newStock = product.stock - item.quantity;
    await prisma.product.update({ where: { id: product.id }, data: { stock: newStock } });
    await prisma.stockMovement.create({ data: { productId: product.id, type: 'SALE', quantity: -item.quantity, reason: `Commande ${orderId}`, userId: userId || null } });
    if (newStock <= product.stockAlert) {
      io.to('admin_room').emit('admin_stock_alert', { productId: product.id, productName: product.name, stock: newStock, stockAlert: product.stockAlert, timestamp: new Date() });
    }
  }
}

async function restoreStock(orderId, userId, previousStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true } } } });
  if (!order) return;
  const stockWasDecremented = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED'].includes(previousStatus);
  if (!stockWasDecremented) return;
  for (const item of order.items) {
    await prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    await prisma.stockMovement.create({ data: { productId: item.productId, type: 'RETURN', quantity: item.quantity, reason: `Annulation/Retour commande ${order.orderNumber}`, userId: userId || null } });
  }
}

// ============ ROUTES D'AUTHENTIFICATION ============
// Auth routes handled by auth.js router

// ============ ROUTES PROFIL UTILISATEUR ============
app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const user = await prisma.client.findUnique({ where: { id: req.userId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true, profileImage: true, whatsapp: true, notificationWhatsApp: true, notificationEmail: true, notificationSMS: true, notificationPush: true } });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(user);
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// ============ ROUTES PANIER ============
app.post('/api/user/cart', verifyToken, async (req, res) => {
  try {
    const { cart } = req.body;
    await prisma.client.update({ where: { id: req.userId }, data: { cart } });
    res.json({ message: 'Panier sauvegardé' });
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

app.get('/api/user/cart', verifyToken, async (req, res) => {
  try {
    const user = await prisma.client.findUnique({ where: { id: req.userId }, select: { cart: true } });
    res.json({ cart: user?.cart || [] });
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// ============ ROUTES COMMANDES ============
app.post('/api/orders/create', async (req, res) => {
  try {
    const { items, total, timeSlot, orderNumber, type, deliveryType, deliveryPrice, deliveryAddress, deliveryCityId, deliveryDistrictId, deliveryStreet, deliveryPhone, deliveryInstructions } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Vous devez être connecté' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    
    // Vérifier que l'utilisateur a un numéro de téléphone
    const user = await prisma.client.findUnique({ 
      where: { id: userId }, 
      select: { phone: true, firstName: true, lastName: true } 
    });
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    
    if (!user.phone || user.phone.trim() === '') {
      return res.status(400).json({ 
        message: 'Veuillez compléter votre profil avec un numéro de téléphone avant de passer commande',
        requiresPhone: true
      });
    }
    
    const normalizedItems = (items || []).filter(i => i.id && !String(i.id).startsWith('promo-')).map(i => ({ productId: i.id, variantId: i.variantId || null, quantity: i.quantity, price: i.price, name: i.name || null, variantType: i.variantType || null, variantValue: i.variantValue || null }));
    
    let slotDate = null;
    if (timeSlot?.date) {
      const dateStr = new Date(timeSlot.date).toISOString().slice(0, 10);
      slotDate = new Date(dateStr + 'T00:00:00.000Z');
    }
    
    const order = await prisma.order.create({
      data: { clientId: userId, orderNumber, type, deliveryType: deliveryType || 'STANDARD', deliveryPrice: deliveryPrice ? parseFloat(deliveryPrice) : 0, total, timeSlotDate: slotDate, timeSlotStart: timeSlot?.slot?.time || null, timeSlotEnd: timeSlot?.slot?.endTime || null, deliveryAddress, deliveryCityId, deliveryDistrictId, deliveryStreet, deliveryPhone, deliveryInstructions, status: 'RECEIVED', items: { create: normalizedItems } },
      include: { items: true, client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, notificationEmail: true, notificationWhatsApp: true, whatsapp: true } } }
    });
    
    await decrementStock(order.items, order.id, userId);
    io.to(`user_${userId}`).emit('notification', { type: 'ORDER_CREATED', title: 'Commande créée', message: `Votre commande ${orderNumber} a été créée`, orderId: order.id, timestamp: new Date() });
    io.to('admin_room').emit('admin_new_order', { id: order.id, orderNumber: order.orderNumber, type: order.type, total: order.total, status: order.status, customerName: order.client ? `${order.client.firstName} ${order.client.lastName}` : 'Client', timeSlotDate: order.timeSlotDate, timeSlotStart: order.timeSlotStart, createdAt: order.createdAt });
    
    if (order.client?.email && order.client.notificationEmail !== false) {
      await sendOrderConfirmation(order.client.email, { orderNumber: order.orderNumber, total: order.total, timeSlotDate: order.timeSlotDate, timeSlotStart: order.timeSlotStart, timeSlotEnd: order.timeSlotEnd, status: order.status, createdAt: order.createdAt, user: order.client });
    }
    
    res.status(201).json({ message: 'Commande créée avec succès', order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

app.get('/api/orders/my-orders', verifyToken, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ where: { clientId: req.userId }, include: { items: { include: { product: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ orders });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/orders/:orderId/cancel', verifyToken, async (req, res) => {
  try {
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, clientId: req.userId } });
    if (!order) return res.status(404).json({ message: 'Commande non trouvée' });
    if (order.status !== 'RECEIVED') return res.status(400).json({ message: 'Cette commande ne peut plus être annulée' });
    const updatedOrder = await prisma.order.update({ where: { id: req.params.orderId }, data: { status: 'CANCELLED' } });
    await restoreStock(req.params.orderId, req.userId, order.status);
    res.json({ message: 'Commande annulée', order: updatedOrder });
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// ============ ROUTES PUBLIQUES ============
app.get('/api/health', (req, res) => { res.json({ status: 'OK' }); });

// ROUTE CORRIGÉE POUR LES CRÉNEAUX
app.get('/api/time-slots/available', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date requise' });

    const targetDate = new Date(date);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    const startOfDay = new Date(year, month, day);
    const endOfDay = new Date(year, month, day + 1);
    const dayOfWeek = startOfDay.getDay();

    // Récupérer les créneaux configurés pour ce jour
    // 1. Récupérer les créneaux MAGASIN (STORE)
    const storeConfigs = await prisma.timeSlotConfig.findMany({
      where: { dayOfWeek: dayOfWeek, active: true, type: 'STORE' },
      orderBy: { startTime: 'asc' }
    });

    if (storeConfigs.length === 0) return res.json([]);

    // 2. Récupérer les créneaux EMPLOYÉS (EMPLOYEE)
    const employeeConfigs = await prisma.timeSlotConfig.findMany({
      where: { dayOfWeek: dayOfWeek, active: true, type: 'EMPLOYEE' }
    });

    // 3. Créneaux bloqués
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: { date: { gte: startOfDay, lt: endOfDay }, active: true }
    });

    // 4. Réservations existantes (Orders)
    const existingOrders = await prisma.order.findMany({
      where: {
        timeSlotDate: { gte: startOfDay, lt: endOfDay },
        timeSlotStart: { not: null },
        status: { notIn: ['CANCELLED', 'COMPLETED'] }
      }
    });

    const reservationsCount = {};
    existingOrders.forEach(order => {
      reservationsCount[order.timeSlotStart] = (reservationsCount[order.timeSlotStart] || 0) + 1;
    });

    const toMinutes = (timeStr) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const toHHMM = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const availableSlots = [];
    const now = new Date();
    const isToday = date === now.toISOString().slice(0, 10);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const storeConfig of storeConfigs) {
      const startMin = toMinutes(storeConfig.startTime);
      const endMin = toMinutes(storeConfig.endTime);
      const step = storeConfig.intervalMinutes || 30;

      for (let cur = startMin; cur < endMin; cur += step) {
        const timeStr = toHHMM(cur);
        const endStr = toHHMM(cur + step);

        // Skip if past time on today
        if (isToday && cur <= currentMinutes + 30) continue;

        // Check if blocked centrally
        const isBlocked = blockedSlots.some(blocked => {
          if (!blocked.startTime) return true;
          const blockStart = toMinutes(blocked.startTime);
          const blockEnd = blocked.endTime ? toMinutes(blocked.endTime) : 24 * 60;
          return cur >= blockStart && cur < blockEnd;
        });
        if (isBlocked) continue;

        // 5. SYNCHRONISATION : Calculer combien d'employés sont dispos pour ce créneau précis
        const availableEmployeesCount = employeeConfigs.filter(emp => {
          const empStart = toMinutes(emp.startTime);
          const empEnd = toMinutes(emp.endTime);
          return cur >= empStart && (cur + step) <= empEnd;
        }).length;

        // Si aucun employé n'est dispo sur ce créneau magasin, on ne propose pas le créneau
        if (availableEmployeesCount === 0) continue;

        const reservations = reservationsCount[timeStr] || 0;
        
        // La capacité réelle est le nombre d'employés disponibles (ou limitée par la capacité magasin si souhaité)
        // Ici on prend le nombre d'employés comme capacité réelle
        const effectiveCapacity = availableEmployeesCount;

        availableSlots.push({
          time: timeStr,
          endTime: endStr,
          capacity: effectiveCapacity,
          reservations: reservations,
          available: reservations < effectiveCapacity
        });
      }
    }

    res.json(availableSlots);
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

app.get('/api/time-slots/config', async (req, res) => {
  try {
    const configs = await prisma.timeSlotConfig.findMany({ where: { active: true }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
    res.json(configs);
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

app.get('/api/delivery-zones/cities', async (req, res) => {
  try {
    const cities = await prisma.deliveryCity.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    res.json(cities);
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

app.get('/api/delivery-zones/districts', async (req, res) => {
  try {
    const { cityId } = req.query;
    if (!cityId) {
      return res.status(400).json({ message: 'ID de ville requis' });
    }
    const districts = await prisma.deliveryDistrict.findMany({
      where: { cityId, active: true },
      orderBy: { name: 'asc' }
    });
    res.json(districts);
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

app.get('/api/delivery-days/available', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysToCheck = parseInt(days);
    
    const availableDays = [];
    const today = new Date();
    
    for (let i = 1; i <= daysToCheck; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      const dateStr = checkDate.toISOString().slice(0, 10);
      const dayOfWeek = checkDate.getDay();
      
      const dayConfig = await prisma.deliveryDayConfig.findUnique({
        where: { dayOfWeek }
      });
      
      if (!dayConfig || !dayConfig.active) {
        availableDays.push({
          date: dateStr,
          dayOfWeek,
          available: false,
          reason: 'Pas de livraison ce jour'
        });
        continue;
      }
      
      const blockedSlot = await prisma.blockedSlot.findFirst({
        where: {
          date: checkDate,
          active: true
        }
      });
      
      if (blockedSlot) {
        availableDays.push({
          date: dateStr,
          dayOfWeek,
          available: false,
          reason: blockedSlot.reason || 'Jour bloqué'
        });
        continue;
      }
      
      const startOfDay = new Date(checkDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const existingOrders = await prisma.order.count({
        where: {
          timeSlotDate: {
            gte: startOfDay,
            lte: endOfDay
          },
          type: 'DELIVERY',
          status: {
            notIn: ['CANCELLED', 'COMPLETED']
          }
        }
      });
      
      const isAvailable = existingOrders < dayConfig.capacity;
      
      availableDays.push({
        date: dateStr,
        dayOfWeek,
        startTime: dayConfig.startTime,
        endTime: dayConfig.endTime,
        capacity: dayConfig.capacity,
        reservations: existingOrders,
        available: isAvailable
      });
    }
    
    res.json(availableDays);
  } catch (error) {
    console.error('Get available delivery days error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});
app.get('/api/reviews/:productId', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({ where: { productId: req.params.productId, approved: true }, orderBy: { createdAt: 'desc' } });
    res.json(reviews);
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

app.post('/api/reviews/:productId', verifyToken, async (req, res) => {
  try {
    const { name, rating, comment } = req.body;
    if (!name || !rating || !comment) return res.status(400).json({ message: 'Nom, note et commentaire requis' });
    const review = await prisma.review.create({ data: { productId: req.params.productId, clientId: req.userId, name, rating: parseInt(rating), comment, approved: false } });
    res.status(201).json({ message: 'Avis soumis, en attente de modération', review });
  } catch (error) { res.status(500).json({ message: 'Erreur serveur' }); }
});

// Start services
startStockNotifier(io);
startBackupCron();
initWhatsAppClient();

// Démarrer le serveur
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`🔌 WebSocket activé sur ws://localhost:${PORT}`);
});

// WebSocket
io.on('connection', (socket) => {
  console.log('👤 Client connecté:', socket.id);
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.join(`user_${decoded.id}`);
      addClientSocket(socket);
      console.log(`✅ Client ${decoded.id} authentifié`);
    } catch (error) { console.error('❌ Erreur authentification WebSocket client:', error); }
  });
  socket.on('admin_authenticate', (adminToken) => {
    try {
      const decoded = jwt.verify(adminToken, JWT_SECRET);
      prisma.admin.findUnique({ where: { id: decoded.id }, select: { isActive: true } }).then(user => {
        if (user && user.isActive) {
          socket.adminId = decoded.id;
          socket.join('admin_room');
          socket.emit('admin_authenticated', { success: true, role: user.role });
        } else socket.emit('admin_authenticated', { success: false, error: 'Accès refusé' });
      });
    } catch (error) { socket.emit('admin_authenticated', { success: false, error: 'Token invalide' }); }
  });
  socket.on('disconnect', () => {
    removeClientSocket(socket);
    if (socket.adminId) console.log(`👋 Admin ${socket.adminId} déconnecté`);
    else if (socket.userId) console.log(`👋 Client ${socket.userId} déconnecté`);
    else console.log(`👋 Socket ${socket.id} déconnecté`);
  });
});

// Cron pour rappels
cron.schedule('*/15 * * * *', async () => {
  try {
    const orders = await prisma.order.findMany({ where: { status: { in: ['RECEIVED', 'PREPARING', 'READY'] }, reminderSent: false, timeSlotStart: { not: null } }, include: { client: true } });
    for (const order of orders) {
      if (!order.timeSlotDate || !order.timeSlotStart || !order.client?.email) continue;
      const [hours, minutes] = order.timeSlotStart.split(':').map(Number);
      const dateStr = order.timeSlotDate.toISOString().slice(0, 10);
      const slotDateTime = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`);
      const slotDateMorocco = new Date(slotDateTime.getTime() - 60 * 60 * 1000);
      const diffMinutes = (slotDateMorocco.getTime() - new Date().getTime()) / (1000 * 60);
      if (diffMinutes >= 105 && diffMinutes <= 135) {
        await sendReminderEmail(order.client.email, order);
        await prisma.order.update({ where: { id: order.id }, data: { reminderSent: true } });
        console.log(`📧 Rappel envoyé pour commande ${order.orderNumber}`);
      }
    }
  } catch (error) { console.error('Cron reminder error:', error); }
});