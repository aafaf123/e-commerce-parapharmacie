import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';
import { httpLogger } from './middleware/httpLogger.js';
import { trackOfflineData } from './middleware/offlineTracker.js';
import { cacheGet } from './utils/redisCache.js';

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
import ordersRoutes from './routes/orders.js';
import reviewsRouter from './routes/reviews.js';

dotenv.config();

const app = express();

app.set('trust proxy', 1);

// ── Compression gzip ─────────────────────────────────────────────────────────
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // En test de charge : désactivé (NODE_ENV=test) ou limite très haute
  max: process.env.NODE_ENV === 'test' ? 0 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, réessayez dans 15 minutes' },
  skip: (req) => req.path === '/api/health' || process.env.DISABLE_RATE_LIMIT === 'true',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 0 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans 15 minutes' },
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
});

app.use(globalLimiter);

app.use(httpLogger); // Log toutes les requêtes HTTP

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const allowedOrigins = [
  'http://localhost',
  'http://localhost:80',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
  'https://steadfast-embrace-production-98bf.up.railway.app',
].filter(Boolean);

// Helper function to get allowed origins (reused in error handlers)
const getAllowedOrigins = () => allowedOrigins;

// Main CORS middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS non autorisé: ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Total-Pages'],
  maxAge: 86400
}));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Preflight OPTIONS requests
app.options('*', cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS non autorisé: ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Total-Pages'],
  maxAge: 86400
}));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/orders', ordersRoutes);
app.use('/api/reviews', reviewsRouter);
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
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/auth', secureAuthRouter);
app.use('/api/user', usersRouter);
app.use('/api/barcode', barcodeRouter);
app.use('/api/time-slots', timeSlotsRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/delivery-zones', deliveryRouter);
app.use('/api/delivery-days', deliveryRouter);
app.use('/api/offline', offlineRouter);

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} introuvable` });
});

// 500 handler with CORS headers
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  const allowed = getAllowedOrigins();

  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Total-Pages');
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack, url: req.originalUrl });
  res.status(500).json({ message: 'Erreur serveur interne' });
});

export default app;