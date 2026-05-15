import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import dotenv from 'dotenv';
import app from './app.js';
import prisma from './prismaClient.js';
import logger from './utils/logger.js';
import { setIo, addClientSocket, removeClientSocket } from './io.js';
import { sendReminderEmail } from './services/emailService.js';
import { startStockNotifier } from './cron/stockNotifier.js';
import { startBackupCron } from './cron/backupDb.js';
import { startNotificationWorker } from './services/notificationService.js';

dotenv.config();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost',
      'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002',
      'http://localhost:3003', 'http://localhost:3004',
      'http://localhost:5173', 'http://localhost:5174',
      process.env.FRONTEND_URL,
      'https://steadfast-embrace-production-98bf.up.railway.app',
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

// ── Redis adapter Socket.io (optionnel — fallback si Redis absent) ─────────────
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => times > 3 ? null : Math.min(times * 200, 1000),
  lazyConnect: true,
});
const subClient = pubClient.duplicate();

pubClient.on('error', () => {});
subClient.on('error', () => {});

// Connecter pub ET sub avant d'appliquer l'adapter
Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io Redis adapter active');
  })
  .catch(() => {
    logger.warn('Redis non disponible - Socket.io en mode single instance');
  });

setIo(io);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

startStockNotifier(io);
startBackupCron();
startNotificationWorker();

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Serveur démarré sur http://localhost:${PORT}`);
  logger.info(`WebSocket activé sur ws://localhost:${PORT}`);
});

io.on('connection', (socket) => {
  logger.debug(`Client connecté: ${socket.id}`);
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.join(`user_${decoded.id}`);
      addClientSocket(socket);
    } catch (error) { logger.warn('Erreur authentification WebSocket client', { error: error.message }); }
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
    if (socket.adminId) logger.debug(`Admin ${socket.adminId} déconnecté`);
    else if (socket.userId) logger.debug(`Client ${socket.userId} déconnecté`);
    else logger.debug(`Socket ${socket.id} déconnecté`);
  });
});

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
      }
    }
  } catch (error) { console.error('Cron reminder error:', error); }
});
