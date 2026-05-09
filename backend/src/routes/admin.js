import express from 'express';
import prisma from '../prismaClient.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getIo } from '../io.js';
import { verifyAdmin, verifyAdminOnly } from '../middleware/auth.js';
import { autoCheckEmployeePermission } from '../middleware/employeePermission.js';
import employeePermissionsRouter from './employeePermissions.js';
import { sendOrderStatusUpdate, sendOrderInvoice } from '../services/emailService.js';
import notify from '../services/notificationService.js';
import { cacheGet, cacheSet, cacheDel, CACHE_KEYS } from '../utils/redisCache.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ==================== LOGIN ADMIN ====================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['admin@parapharmacie.ma'];
    
    if (!adminEmails.includes(email)) {
      return res.status(403).json({ message: 'Accès administrateur non autorisé' });
    }

    const user = await prisma.admin.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(403).json({ message: 'Accès administrateur non autorisé' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Connexion admin réussie',
      token,
      user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: 'ADMIN' }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================== KPIs & STATISTIQUES ====================
router.get('/kpis', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const cached = await cacheGet('admin:kpis');
    if (cached) return res.json(cached);

    const nowMorocco = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
    const todayStr = nowMorocco.toISOString().split('T')[0];
    const today = new Date(todayStr + 'T00:00:00.000Z');
    today.setHours(today.getHours() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstDayOfMonth = new Date(nowMorocco.getFullYear(), nowMorocco.getMonth(), 1);
    firstDayOfMonth.setHours(firstDayOfMonth.getHours() - 1);
    const firstDayOfNextMonth = new Date(nowMorocco.getFullYear(), nowMorocco.getMonth() + 1, 1);
    firstDayOfNextMonth.setHours(firstDayOfNextMonth.getHours() - 1);

    const [ordersToday, dailyRevenue, monthlyRevenue, outOfStock, lowStock, slotsReservedToday, pendingOrders, expiringSoon] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
      prisma.order.aggregate({ where: { createdAt: { gte: today, lt: tomorrow }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: firstDayOfMonth, lt: firstDayOfNextMonth }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { stock: { gt: 0, lte: 10 } } }),
      prisma.order.count({ where: { timeSlotDate: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED', 'COMPLETED'] } } }),
      prisma.order.count({ where: { status: 'RECEIVED' } }),
      prisma.product.count({ where: { expiryDate: { gt: new Date(), lte: new Date(new Date().setMonth(new Date().getMonth() + 3)) } } })
    ]);

    const result = {
      ordersToday,
      dailyRevenue: dailyRevenue._sum.total || 0,
      monthlyRevenue: monthlyRevenue._sum.total || 0,
      outOfStock, lowStock, slotsReservedToday, pendingOrders, expiringSoon
    };

    await cacheSet('admin:kpis', result, 60); // cache 60s
    res.json(result);
  } catch (error) {
    console.error('KPIs error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/sales-chart', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const now = new Date();
    let startDate = new Date();
    let groupBy = 'day';

    if (period === '7d') startDate.setFullYear(now.getFullYear() - 1); // large range
    else if (period === '30d') startDate.setFullYear(now.getFullYear() - 2);
    else if (period === '12m') { startDate.setFullYear(now.getFullYear() - 3); groupBy = 'month'; }
    const endDate = new Date(now.getFullYear() + 2, 11, 31); // include future dates

    const orders = await prisma.order.findMany({ where: { createdAt: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } }, select: { createdAt: true, total: true } });
    const salesData = {};
    orders.forEach(order => {
      let key = groupBy === 'day' ? order.createdAt.toISOString().split('T')[0] : `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!salesData[key]) salesData[key] = { date: key, revenue: 0, orders: 0 };
      salesData[key].revenue += order.total;
      salesData[key].orders += 1;
    });
    res.json(Object.values(salesData).sort((a, b) => a.date.localeCompare(b.date)));
  } catch (error) {
    console.error('Sales chart error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/urgent-orders', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const now = new Date();
    const todayUtcStart = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const candidates = await prisma.order.findMany({
      where: { timeSlotDate: { gte: todayUtcStart, lte: threeDaysLater }, timeSlotStart: { not: null }, status: { in: ['RECEIVED', 'PREPARING'] } },
      include: { client: { select: { firstName: true, lastName: true, phone: true, email: true } }, items: { include: { product: { select: { name: true, image: true } } } } },
      orderBy: [{ timeSlotDate: 'asc' }, { timeSlotStart: 'asc' }]
    });
    const timeframeHours = parseInt(req.query.hours) || 2;
    const timeframeMs = timeframeHours * 60 * 60 * 1000;
    const urgentOrders = candidates.map(order => {
      const dateStr = order.timeSlotDate.toISOString().slice(0, 10);
      const [h, m] = order.timeSlotStart.split(':').map(Number);
      const slotDatetime = new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
      const slotDatetimeUTC = new Date(slotDatetime.getTime() - 60 * 60 * 1000);
      const diffMs = slotDatetimeUTC.getTime() - now.getTime();
      return { ...order, _diffMs: diffMs };
    }).filter(order => order._diffMs >= 0 && order._diffMs <= timeframeMs).map(({ _diffMs, ...order }) => ({ ...order, minutesUntilSlot: Math.floor(_diffMs / 60000) }));
    res.json(urgentOrders);
  } catch (error) {
    console.error('Urgent orders error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/recent-orders', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const orders = await prisma.order.findMany({ take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { client: { select: { firstName: true, lastName: true, email: true, phone: true } }, items: { include: { product: { select: { name: true, image: true, id: true } } } } } });
    res.json(orders);
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/low-stock-products', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    const products = await prisma.product.findMany({ where: { stock: { lte: parseInt(threshold) } }, select: { id: true, name: true, stock: true, image: true, price: true, brand: true }, orderBy: { stock: 'asc' } });
    res.json(products);
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/stock/alerts', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    const products = await prisma.product.findMany({ where: { stock: { lte: parseInt(threshold) } }, select: { id: true, name: true, stock: true, image: true, price: true, brand: true }, orderBy: { stock: 'asc' } });
    res.json(products);
  } catch (error) {
    console.error('Stock alerts error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/stock/movements', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 30, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (type) where.type = type;
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true, image: true } },
        variant: { select: { type: true, value: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    });
    const total = await prisma.stockMovement.count({ where });
    res.json({
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Stock movements error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/stock/stats-totals', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const salesResult = await prisma.stockMovement.aggregate({
      where: { type: 'SALE' },
      _sum: { quantity: true }
    });
    const returnsResult = await prisma.stockMovement.aggregate({
      where: { type: 'RETURN' },
      _sum: { quantity: true }
    });
    res.json({
      salesTotal: Math.abs(salesResult._sum.quantity || 0),
      returnsTotal: returnsResult._sum.quantity || 0
    });
  } catch (error) {
    console.error('Stock stats totals error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/expiring-products', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { months = 3 } = req.query;
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(now.getMonth() + parseInt(months));
    const products = await prisma.product.findMany({ where: { expiryDate: { gt: now, lte: futureDate } }, select: { id: true, name: true, stock: true, image: true, expiryDate: true, brand: true }, orderBy: { expiryDate: 'asc' } });
    res.json(products);
  } catch (error) {
    console.error('Expiring products error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/heatmap-slots', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const orders = await prisma.order.findMany({ where: { timeSlotDate: { gte: startDate }, timeSlotStart: { not: null } }, select: { timeSlotStart: true, timeSlotDate: true } });
    const heatmap = {};
    const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    orders.forEach(order => { const key = `${daysOfWeek[new Date(order.timeSlotDate).getDay()]}-${order.timeSlotStart}`; heatmap[key] = (heatmap[key] || 0) + 1; });
    const heatmapData = [];
    for (let day = 1; day < 7; day++) {
      for (let hour = 9; hour < 19; hour++) {
        for (let minute of [0, 30]) {
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          heatmapData.push({ day: daysOfWeek[day], time: timeStr, count: heatmap[`${daysOfWeek[day]}-${timeStr}`] || 0 });
        }
      }
    }
    res.json(heatmapData);
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================== COMMANDES ====================
router.get('/orders', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = status ? { status } : {};
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { client: { firstName: { contains: search, mode: 'insensitive' } } },
        { client: { lastName: { contains: search, mode: 'insensitive' } } },
        { items: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } },
        { items: { some: { product: { barcode: { contains: search, mode: 'insensitive' } } } } },
        { items: { some: { product: { sku: { contains: search, mode: 'insensitive' } } } } }
      ];
    }
    const allOrders = await prisma.order.findMany({
      where,
      include: { client: { select: { firstName: true, lastName: true, email: true, phone: true } }, items: { include: { product: { select: { name: true, image: true, price: true } } } } },
      orderBy: { createdAt: 'desc' }
    });
    const sortedOrders = [...allOrders].sort((a, b) => {
      const aType = a.type || 'CLICK_COLLECT';
      const bType = b.type || 'CLICK_COLLECT';
      if (aType === 'CLICK_COLLECT' && bType !== 'CLICK_COLLECT') return -1;
      if (aType !== 'CLICK_COLLECT' && bType === 'CLICK_COLLECT') return 1;
      return a.createdAt - b.createdAt;
    });
    const paginatedOrders = sortedOrders.slice(skip, skip + parseInt(limit));
    res.json({ orders: paginatedOrders, pagination: { page: parseInt(page), limit: parseInt(limit), total: allOrders.length, totalPages: Math.ceil(allOrders.length / parseInt(limit)) } });
  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.put('/orders/:orderId/status', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const orderBefore = await prisma.order.findUnique({ where: { id: orderId }, include: { client: true, items: { include: { product: { select: { id: true, name: true, stock: true, stockAlert: true } } } } } });
    if (!orderBefore) return res.status(404).json({ message: 'Commande non trouvée' });
    const order = await prisma.order.update({ where: { id: orderId }, data: { status }, include: { client: true, items: { include: { product: true } } } });
    const io = getIo();
    if (status === 'PREPARING' && orderBefore.status === 'RECEIVED') {
      for (const item of orderBefore.items) {
        const newStock = Math.max(0, item.product.stock - item.quantity);
        await prisma.product.update({ where: { id: item.productId }, data: { stock: newStock } });
        await prisma.stockMovement.create({ data: { productId: item.productId, type: 'SALE', quantity: -item.quantity, reason: `Commande confirmée ${orderBefore.orderNumber}`, userId: req.userId } });
        if (io && newStock <= item.product.stockAlert) io.to('admin_room').emit('admin_stock_alert', { productId: item.productId, productName: item.product.name, stock: newStock, stockAlert: item.product.stockAlert, timestamp: new Date() });
      }
    }
    const STOCK_DEDUCTED_STATUSES = ['PREPARING', 'READY', 'COMPLETED'];
    const TERMINAL_STATUSES = ['CANCELLED', 'REFUNDED', 'RETURNED'];
    const stockWasPreviouslyDeducted = STOCK_DEDUCTED_STATUSES.includes(orderBefore.status);
    const isNowTerminal = TERMINAL_STATUSES.includes(status);
    const wasAlreadyTerminal = TERMINAL_STATUSES.includes(orderBefore.status);
    if (isNowTerminal && stockWasPreviouslyDeducted && !wasAlreadyTerminal) {
      for (const item of orderBefore.items) {
        const newStock = item.product.stock + item.quantity;
        await prisma.product.update({ where: { id: item.productId }, data: { stock: newStock } });
        await prisma.stockMovement.create({ data: { productId: item.productId, type: 'RETURN', quantity: item.quantity, reason: `${status === 'RETURNED' ? 'Retour produit' : 'Annulation'} commande ${orderBefore.orderNumber}`, userId: req.userId } });
      }
    }
    if (order.client?.email && order.client.notificationEmail !== false) {
      await notify.orderStatusUpdate(order.client.email, order, status);
    }
    if (status === 'COMPLETED' && orderBefore.status !== 'COMPLETED' && order.client?.email && order.client.notificationEmail !== false) {
      await notify.orderInvoice(order.client.email, order);
    }
    res.json({ message: 'Statut mis à jour', order });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================== CODES PROMO ====================
router.get('/promo-codes', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = active !== undefined ? { active: active === 'true' } : {};
    const [promoCodes, total] = await Promise.all([prisma.promoCode.findMany({ where, include: { promoHistory: { select: { id: true } } }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }), prisma.promoCode.count({ where })]);
    const withStats = promoCodes.map(promo => ({ ...promo, usageCount: promo.promoHistory.length, promoHistory: undefined }));
    res.json({ promoCodes: withStats, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error('Promo codes list error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/promo-codes', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { code, description, discountType, discountValue, applicableOn, productIds, categoryIds, minPurchaseAmount, maxDiscountAmount, usageLimit, expiryDate, active } = req.body;
    if (!code || !discountValue) return res.status(400).json({ message: 'Code et valeur de réduction requis' });
    const promoCode = await prisma.promoCode.create({ data: { code: code.toUpperCase(), description, discountType: discountType || 'percentage', discountValue: parseFloat(discountValue), applicableOn: applicableOn || 'global', productIds: productIds ? (Array.isArray(productIds) ? productIds : JSON.parse(productIds)) : [], categoryIds: categoryIds ? (Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds)) : [], minPurchaseAmount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : 0, maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null, usageLimit: usageLimit ? parseInt(usageLimit) : null, expiryDate: expiryDate ? new Date(expiryDate) : null, active: active !== false } });
    const io = getIo();
    if (io) io.emit('notification', { type: 'PROMO_CODE', title: '🎉 Nouveau code promo !', message: `Utilisez le code ${promoCode.code} pour bénéficier de ${promoCode.discountType === 'percentage' ? `${promoCode.discountValue}% de réduction` : `${promoCode.discountValue} DH de réduction`}${promoCode.expiryDate ? ` jusqu'au ${new Date(promoCode.expiryDate).toLocaleDateString('fr-FR')}` : ''}`, code: promoCode.code, discountType: promoCode.discountType, discountValue: promoCode.discountValue, expiryDate: promoCode.expiryDate, timestamp: new Date() });
    res.status(201).json({ message: 'Code promo créé', promoCode });
  } catch (error) {
    console.error('Create promo code error:', error);
    if (error.code === 'P2002') return res.status(400).json({ message: 'Ce code promo existe déjà' });
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/promo-codes/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const promoCode = await prisma.promoCode.findUnique({ where: { id }, include: { promoHistory: { include: { order: { select: { id: true, orderNumber: true, total: true, createdAt: true, client: { select: { id: true, email: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 } } });
    if (!promoCode) return res.status(404).json({ message: 'Code promo non trouvé' });
    res.json(promoCode);
  } catch (error) {
    console.error('Get promo code error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/promo-codes/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, discountType, discountValue, applicableOn, productIds, categoryIds, minPurchaseAmount, maxDiscountAmount, usageLimit, expiryDate, active } = req.body;
    const promoCode = await prisma.promoCode.update({ where: { id }, data: { ...(description !== undefined && { description }), ...(discountType && { discountType }), ...(discountValue !== undefined && { discountValue: parseFloat(discountValue) }), ...(applicableOn && { applicableOn }), ...(productIds && { productIds: Array.isArray(productIds) ? productIds : JSON.parse(productIds) }), ...(categoryIds && { categoryIds: Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds) }), ...(minPurchaseAmount !== undefined && { minPurchaseAmount: parseFloat(minPurchaseAmount) }), ...(maxDiscountAmount !== undefined && { maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null }), ...(usageLimit !== undefined && { usageLimit: usageLimit ? parseInt(usageLimit) : null }), ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }), ...(active !== undefined && { active }) } });
    res.json({ message: 'Code promo mis à jour', promoCode });
  } catch (error) {
    console.error('Update promo code error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/promo-codes/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.promoCode.delete({ where: { id } });
    res.json({ message: 'Code promo supprimé' });
  } catch (error) {
    console.error('Delete promo code error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== PROMOTIONS ====================
router.get('/test', (req, res) => res.json({ message: 'test' }));

router.get('/promotions', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = active !== undefined ? { active: active === 'true' } : {};
    const [promotions, total] = await Promise.all([prisma.promotion.findMany({ where, include: { stats: true }, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit) }), prisma.promotion.count({ where })]);
    res.json({ promotions, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    console.error('Promotions list error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/promotions', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { title, description, subtitle, bannerImage, discountType, discountValue, oldPrice, price, stock, rating, productId, productName, productImage, badge, badgeColor, bgColor, iconName, features, ctaText, active, order, startDate, endDate } = req.body;
    if (!title || !startDate || !endDate) return res.status(400).json({ message: 'Titre et dates requis' });
    const promotion = await prisma.promotion.create({ data: { title, description, subtitle, bannerImage, discountType: discountType || 'percentage', discountValue: parseFloat(discountValue), oldPrice: oldPrice ? parseFloat(oldPrice) : null, price: price ? parseFloat(price) : null, stock: stock ? parseInt(stock) : null, rating: rating ? parseFloat(rating) : null, productId, productName, productImage, badge, badgeColor, bgColor, iconName, features: features || [], ctaText: ctaText || 'Profiter maintenant', active: active !== false, order: order || 0, startDate: new Date(startDate), endDate: new Date(endDate) } });
    await prisma.promotionStats.create({ data: { promotionId: promotion.id } });
    res.status(201).json({ message: 'Promotion créée', promotion });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/promotions/history', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  console.log('Promotions history route hit');
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();
    let where = {};

    if (status === 'active') {
      where.active = true;
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    } else if (status === 'expired') {
      where.endDate = { lt: now };
    } else if (status === 'scheduled') {
      where.startDate = { gt: now };
    }

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include: { stats: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.promotion.count({ where })
    ]);

    const globalStatsAggregate = await prisma.promotionStats.aggregate({
      _sum: {
        impressions: true,
        clicks: true,
        conversions: true,
        totalDiscount: true,
        ordersCount: true
      }
    });

    res.json({
      promotions,
      globalStats: {
        totalImpressions: globalStatsAggregate._sum.impressions || 0,
        totalClicks: globalStatsAggregate._sum.clicks || 0,
        totalConversions: globalStatsAggregate._sum.conversions || 0,
        totalDiscount: globalStatsAggregate._sum.totalDiscount || 0,
        totalOrders: globalStatsAggregate._sum.ordersCount || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Promotions history error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/promotions/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const promotion = await prisma.promotion.findUnique({ where: { id }, include: { stats: true } });
    if (!promotion) return res.status(404).json({ message: 'Promotion non trouvée' });
    res.json(promotion);
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/promotions/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, bannerImage, bannerText, discountType, discountValue, applicableOn, productIds, categoryIds, minPurchaseAmount, maxDiscountAmount, startDate, endDate, displayOnHomepage, order, active } = req.body;
    const promotion = await prisma.promotion.update({ where: { id }, data: { ...(title && { title }), ...(description !== undefined && { description }), ...(bannerImage !== undefined && { bannerImage }), ...(bannerText !== undefined && { bannerText }), ...(discountType && { discountType }), ...(discountValue !== undefined && { discountValue: parseFloat(discountValue) }), ...(applicableOn && { applicableOn }), ...(productIds && { productIds: Array.isArray(productIds) ? productIds : JSON.parse(productIds) }), ...(categoryIds && { categoryIds: Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds) }), ...(minPurchaseAmount !== undefined && { minPurchaseAmount: parseFloat(minPurchaseAmount) }), ...(maxDiscountAmount !== undefined && { maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null }), ...(startDate && { startDate: new Date(startDate) }), ...(endDate && { endDate: new Date(endDate) }), ...(displayOnHomepage !== undefined && { displayOnHomepage }), ...(order !== undefined && { order: parseInt(order) }), ...(active !== undefined && { active }) }, include: { stats: true } });
    res.json({ message: 'Promotion mise à jour', promotion });
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/promotions/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.promotionStats.deleteMany({ where: { promotionId: id } });
    await prisma.promotion.delete({ where: { id } });
    res.json({ message: 'Promotion supprimée' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/promotions/history', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  console.log('Promotions history route hit');
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();
    let where = {};

    if (status === 'active') {
      where.active = true;
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    } else if (status === 'expired') {
      where.endDate = { lt: now };
    } else if (status === 'scheduled') {
      where.startDate = { gt: now };
    }

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include: { stats: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.promotion.count({ where })
    ]);

    const globalStatsAggregate = await prisma.promotionStats.aggregate({
      _sum: {
        impressions: true,
        clicks: true,
        conversions: true,
        totalDiscount: true,
        ordersCount: true
      }
    });

    res.json({
      promotions,
      globalStats: {
        totalImpressions: globalStatsAggregate._sum.impressions || 0,
        totalClicks: globalStatsAggregate._sum.clicks || 0,
        totalConversions: globalStatsAggregate._sum.conversions || 0,
        totalDiscount: globalStatsAggregate._sum.totalDiscount || 0,
        totalOrders: globalStatsAggregate._sum.ordersCount || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Promotions history error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== LIVRAISON ====================
router.get('/delivery-zones/cities', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { all = 'false' } = req.query;
    const where = all === 'true' ? {} : { active: true };
    const cities = await prisma.deliveryCity.findMany({
      where,
      include: { districts: { where: all === 'true' ? {} : { active: true }, orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' }
    });
    res.json(cities);
  } catch (error) {
    console.error('Get delivery cities error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/delivery-zones/cities', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { name, active = true, order = 0 } = req.body;
    if (!name) return res.status(400).json({ message: 'Nom requis' });
    const city = await prisma.deliveryCity.create({
      data: { name, active, order }
    });
    res.status(201).json(city);
  } catch (error) {
    console.error('Create delivery city error:', error);
    if (error.code === 'P2002') return res.status(400).json({ message: 'Cette ville existe déjà' });
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/delivery-zones/cities/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, active, order } = req.body;
    const city = await prisma.deliveryCity.update({
      where: { id },
      data: { ...(name && { name }), ...(active !== undefined && { active }), ...(order !== undefined && { order }) }
    });
    res.json(city);
  } catch (error) {
    console.error('Update delivery city error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/delivery-zones/cities/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.deliveryCity.update({
      where: { id },
      data: { active: false }
    });
    res.json({ message: 'Ville désactivée' });
  } catch (error) {
    console.error('Delete delivery city error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/delivery/config', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const configs = await prisma.deliveryDayConfig.findMany({
      orderBy: { dayOfWeek: 'asc' }
    });
    res.json(configs);
  } catch (error) {
    console.error('Get delivery config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/delivery/config/:dayOfWeek', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    const { startTime, endTime, capacity, active } = req.body;
    const config = await prisma.deliveryDayConfig.upsert({
      where: { dayOfWeek: parseInt(dayOfWeek) },
      update: { ...(startTime && { startTime }), ...(endTime && { endTime }), ...(capacity !== undefined && { capacity: parseInt(capacity) }), ...(active !== undefined && { active }) },
      create: { dayOfWeek: parseInt(dayOfWeek), startTime: startTime || '10:00', endTime: endTime || '18:00', capacity: capacity || 7, active: active !== false }
    });
    res.json(config);
  } catch (error) {
    console.error('Update delivery config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== MARQUES ====================
router.get('/brands', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { search, active } = req.query;
    const where = {};
    
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (active !== undefined) {
      where.active = active === 'true';
    }

    const brands = await prisma.brand.findMany({
      where,
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(brands);
  } catch (error) {
    console.error('Get brands error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/brands', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { name, logo, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nom de la marque requis' });
    }

    // Vérifier si la marque existe déjà
    const existingBrand = await prisma.brand.findUnique({
      where: { name: name.trim() }
    });

    if (existingBrand) {
      return res.status(400).json({ message: 'Cette marque existe déjà' });
    }

    const brand = await prisma.brand.create({
      data: {
        name: name.trim(),
        logo: logo || null,
        description: description || null,
        active: true
      }
    });

    res.status(201).json({ message: 'Marque créée', brand });
  } catch (error) {
    console.error('Create brand error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Cette marque existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/brands/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo, description, active } = req.body;

    const brand = await prisma.brand.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(logo !== undefined && { logo }),
        ...(description !== undefined && { description }),
        ...(active !== undefined && { active })
      }
    });

    res.json({ message: 'Marque mise à jour', brand });
  } catch (error) {
    console.error('Update brand error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Cette marque existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/brands/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier s'il y a des produits associés
    const productsCount = await prisma.product.count({
      where: { brandId: id }
    });

    if (productsCount > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer cette marque car ${productsCount} produit(s) l'utilisent` 
      });
    }

    await prisma.brand.delete({ where: { id } });
    res.json({ message: 'Marque supprimée' });
  } catch (error) {
    console.error('Delete brand error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// Route pour créer automatiquement une marque lors de la saisie d'un produit
router.post('/brands/auto-create', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nom de la marque requis' });
    }

    const brandName = name.trim();

    // Vérifier si la marque existe déjà
    let brand = await prisma.brand.findUnique({
      where: { name: brandName }
    });

    if (!brand) {
      // Créer la marque automatiquement
      brand = await prisma.brand.create({
        data: {
          name: brandName,
          active: true
        }
      });
    }

    res.json({ brand });
  } catch (error) {
    console.error('Auto-create brand error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== NOTIFICATIONS ====================
router.get('/notifications', verifyAdmin, async (req, res) => {
  try {
    const { read = 'false', limit = 50 } = req.query;
    const notifications = await prisma.notification.findMany({
      where: { read: read === 'true', clientId: null }, // Admin notifications
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/notifications/unread-count', verifyAdmin, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { read: false, clientId: null }
    });
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/notifications/:id/read', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });
    res.json(notification);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/notifications/mark-all-read', verifyAdmin, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { read: false, clientId: null },
      data: { read: true }
    });
    res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/notifications/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({ where: { id } });
    res.json({ message: 'Notification supprimée' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'Notification non trouvée' });
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/notifications', verifyAdmin, async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { clientId: null } });
    res.json({ message: 'Toutes les notifications supprimées' });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== GESTION DES CRÉNEAUX UNIFIÉS (STORE & EMPLOYEE) ====================
router.get('/time-slots/config', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { all, type, employeeId } = req.query;
    const where = {};
    if (all !== 'true') where.active = true;
    if (type) where.type = type;
    if (employeeId) where.employeeId = employeeId;
    
    // If user is EMPLOYE, and no employeeId requested, default to their own
    if (req.userRole === 'EMPLOYE' && !employeeId && type === 'EMPLOYEE') {
      where.employeeId = req.userId;
    }

    const configs = await prisma.timeSlotConfig.findMany({ 
      where, 
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] 
    });
    res.json(configs);
  } catch (error) {
    console.error('Get time slot config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/time-slots/config', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, capacity, intervalMinutes, active } = req.body;
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ message: 'Jour, heure de début et heure de fin requis' });
    }
    
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return res.status(400).json({ message: 'Format d\'heure invalide. Utilisez HH:MM' });
    }
    
    if (startTime >= endTime) {
      return res.status(400).json({ message: 'L\'heure de début doit être antérieure à l\'heure de fin' });
    }
    
    const overlapping = await prisma.timeSlotConfig.findFirst({
      where: {
        dayOfWeek: parseInt(dayOfWeek),
        type: req.body.type || 'STORE',
        employeeId: (req.body.type === 'EMPLOYEE' && req.body.employeeId) ? req.body.employeeId : (req.body.type === 'EMPLOYEE' && req.userRole === 'EMPLOYE' ? req.userId : null),
        active: true,
        OR: [
          { startTime: { lt: endTime }, endTime: { gt: startTime } }
        ]
      }
    });
    
    if (overlapping) {
      return res.status(400).json({ message: 'Ce créneau chevauche un autre créneau existant sur ce jour' });
    }
    
    const config = await prisma.timeSlotConfig.create({ 
      data: { 
        dayOfWeek: parseInt(dayOfWeek), 
        startTime, 
        endTime, 
        capacity: capacity || 5, 
        intervalMinutes: intervalMinutes || 30, 
        active: active !== undefined ? active : true,
        type: req.body.type || 'STORE',
        employeeId: (req.body.type === 'EMPLOYEE' && req.body.employeeId) ? req.body.employeeId : (req.body.type === 'EMPLOYEE' && req.userRole === 'EMPLOYE' ? req.userId : null)
      } 
    });
    
    const io = getIo();
    if (io) io.to('admin_room').emit('time_slots_changed', { action: 'create', data: config });
    
    res.status(201).json({ message: 'Créneau créé', config });
  } catch (error) {
    console.error('Create time slot config error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Cette configuration existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/time-slots/config/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, capacity, intervalMinutes, active } = req.body;
    
    const currentConfig = await prisma.timeSlotConfig.findUnique({ where: { id } });
    if (!currentConfig) {
      return res.status(404).json({ message: 'Configuration non trouvée' });
    }
    
    const newStartTime = startTime || currentConfig.startTime;
    const newEndTime = endTime || currentConfig.endTime;
    
    if (!/^\d{2}:\d{2}$/.test(newStartTime) || !/^\d{2}:\d{2}$/.test(newEndTime)) {
      return res.status(400).json({ message: 'Format d\'heure invalide. Utilisez HH:MM' });
    }
    
    if (newStartTime >= newEndTime) {
      return res.status(400).json({ message: 'L\'heure de début doit être antérieure à l\'heure de fin' });
    }
    
    const overlapping = await prisma.timeSlotConfig.findFirst({
      where: {
        id: { not: id },
        dayOfWeek: currentConfig.dayOfWeek,
        type: currentConfig.type,
        employeeId: (currentConfig.type === 'EMPLOYEE' && req.body.employeeId) ? req.body.employeeId : currentConfig.employeeId,
        active: true,
        OR: [
          { startTime: { lt: newEndTime }, endTime: { gt: newStartTime } }
        ]
      }
    });
    
    if (overlapping) {
      return res.status(400).json({ message: 'Ce créneau chevauche un autre créneau existant sur ce jour' });
    }
    
    const config = await prisma.timeSlotConfig.update({ 
      where: { id }, 
      data: { 
        startTime: newStartTime, 
        endTime: newEndTime, 
        ...(capacity !== undefined && { capacity }), 
        ...(intervalMinutes !== undefined && { intervalMinutes }), 
        ...(active !== undefined && { active }),
        ...(req.body.type && { type: req.body.type }),
        ...(req.body.employeeId !== undefined && { employeeId: req.body.employeeId })
      } 
    });
    
    const io = getIo();
    if (io) io.to('admin_room').emit('time_slots_changed', { action: 'update', data: config });
    
    res.json({ message: 'Créneau modifié', config });
  } catch (error) {
    console.error('Update time slot config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/time-slots/config/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.timeSlotConfig.delete({ where: { id } });
    
    const io = getIo();
    if (io) io.to('admin_room').emit('time_slots_changed', { action: 'delete', data: { id } });
    
    res.json({ message: 'Configuration supprimée' });
  } catch (error) {
    console.error('Delete time slot config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== CRÉNEAUX BLOQUÉS ====================
router.get('/time-slots/blocked', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const blockedSlots = await prisma.blockedSlot.findMany({ where: { active: true }, orderBy: { date: 'asc' } });
    res.json(blockedSlots);
  } catch (error) {
    console.error('Get blocked slots error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.post('/time-slots/blocked', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body;
    if (!date || !reason) {
      return res.status(400).json({ message: 'Date et raison requis' });
    }
    
    const blockedSlot = await prisma.blockedSlot.create({ 
      data: { 
        date: new Date(date + 'T00:00:00.000Z'), 
        startTime: startTime || null, 
        endTime: endTime || null, 
        reason, 
        active: true 
      } 
    });
    
    res.status(201).json(blockedSlot);
  } catch (error) {
    console.error('Create blocked slot error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ce créneau est déjà bloqué' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/time-slots/blocked/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.blockedSlot.update({ where: { id }, data: { active: false } });
    res.json({ message: 'Créneau débloqué' });
  } catch (error) {
    console.error('Delete blocked slot error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== CRÉNEAUX DISPONIBLES (PUBLIC) ====================


router.get('/time-slots/calendar', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const orders = await prisma.order.findMany({ 
      where: { 
        timeSlotDate: { gte: start, lte: end }, 
        timeSlotStart: { not: null } 
      }, 
      select: { 
        id: true, 
        orderNumber: true, 
        timeSlotDate: true, 
        timeSlotStart: true, 
        timeSlotEnd: true, 
        total: true, 
        status: true, 
        client: { 
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            phone: true 
          } 
        } 
      }, 
      orderBy: [{ timeSlotDate: 'asc' }, { timeSlotStart: 'asc' }] 
    });
    
    const calendarData = {};
    orders.forEach(order => { 
      const dateKey = order.timeSlotDate.toISOString().split('T')[0]; 
      if (!calendarData[dateKey]) calendarData[dateKey] = []; 
      calendarData[dateKey].push(order); 
    });
    
    res.json(calendarData);
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/time-slots/today-reservations', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const orders = await prisma.order.findMany({ 
      where: { 
        timeSlotDate: today, 
        timeSlotStart: { not: null }, 
        status: { in: ['RECEIVED', 'PREPARING', 'READY'] } 
      }, 
      select: { 
        id: true, 
        orderNumber: true, 
        timeSlotStart: true, 
        timeSlotEnd: true, 
        total: true, 
        status: true, 
        createdAt: true, 
        client: { 
          select: { 
            firstName: true, 
            lastName: true, 
            email: true, 
            phone: true 
          } 
        }, 
        items: { 
          select: { 
            quantity: true, 
            price: true, 
            product: { 
              select: { name: true } 
            } 
          } 
        } 
      }, 
      orderBy: { timeSlotStart: 'asc' } 
    });
    
    res.json(orders);
  } catch (error) {
    console.error('Get today reservations error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== UTILISATEURS ====================
router.get('/users', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status, sortBy = 'createdAt', sortOrder = 'desc', includeCart } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }
    if (status && status !== 'ALL') where.isActive = status === 'ACTIVE';

    const orderByClause = sortBy === 'orderCount' 
      ? { orders: { _count: sortOrder } } 
      : { [sortBy]: sortOrder };

    const [users, total] = await Promise.all([
      prisma.client.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          ...(includeCart === 'true' ? { cart: true } : {}),
          _count: { select: { orders: true } }
        }, 
        orderBy: orderByClause, 
        skip, 
        take: parseInt(limit) 
      }),
      prisma.client.count({ where })
    ]);

    res.json({ 
      users, 
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total, 
        totalPages: Math.ceil(total / parseInt(limit)) 
      } 
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/users/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.client.findUnique({ 
      where: { id }, 
      select: { 
        id: true, 
        email: true, 
        firstName: true, 
        lastName: true, 
        phone: true, 
        address: true, 
        profileImage: true, 
        notificationEmail: true, 
        notificationSMS: true, 
        notificationPush: true, 
        role: true, 
        isActive: true, 
        cart: true, 
        createdAt: true, 
        updatedAt: true, 
        _count: { select: { orders: true, favorites: true } }, 
        orders: { 
          select: { 
            id: true, 
            orderNumber: true, 
            status: true, 
            total: true, 
            timeSlotDate: true, 
            timeSlotStart: true, 
            createdAt: true, 
            items: { 
              select: { 
                quantity: true, 
                price: true, 
                product: { select: { name: true } } 
              } 
            } 
          }, 
          orderBy: { createdAt: 'desc' }, 
          take: 10 
        } 
      } 
    });
    
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(user);
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/users/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, address, role, isActive, notificationEmail, notificationSMS, notificationPush } = req.body;
    
    const oldUser = await prisma.client.findUnique({ 
      where: { id }, 
      select: { 
        firstName: true, 
        lastName: true, 
        phone: true, 
        address: true, 
        role: true, 
        isActive: true, 
        notificationEmail: true, 
        notificationSMS: true, 
        notificationPush: true 
      } 
    });
    
    if (!oldUser) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    const updatedUser = await prisma.client.update({ 
      where: { id }, 
      data: { 
        ...(firstName !== undefined && { firstName }), 
        ...(lastName !== undefined && { lastName }), 
        ...(phone !== undefined && { phone }), 
        ...(address !== undefined && { address }), 
        ...(role !== undefined && { role }), 
        ...(isActive !== undefined && { isActive }), 
        ...(notificationEmail !== undefined && { notificationEmail }), 
        ...(notificationSMS !== undefined && { notificationSMS }), 
        ...(notificationPush !== undefined && { notificationPush }) 
      }, 
      select: { 
        id: true, 
        email: true, 
        firstName: true, 
        lastName: true, 
        phone: true, 
        role: true, 
        isActive: true, 
        updatedAt: true 
      } 
    });
    
    await prisma.auditLog.create({ 
      data: { 
        userId: req.userId, 
        action: 'UPDATE', 
        entityType: 'User', 
        entityId: id, 
        oldValues: oldUser, 
        newValues: { firstName, lastName, phone, address, role, isActive, notificationEmail, notificationSMS, notificationPush }, 
        ipAddress: req.ip, 
        userAgent: req.get('User-Agent'), 
        description: `Modification de l'utilisateur ${updatedUser.email}` 
      } 
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/users/:id/status', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Le statut doit être un booléen' });
    }
    
    const oldUser = await prisma.client.findUnique({ 
      where: { id }, 
      select: { isActive: true, email: true } 
    });
    
    if (!oldUser) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    const updatedUser = await prisma.client.update({ 
      where: { id }, 
      data: { isActive }, 
      select: { id: true, email: true, isActive: true, updatedAt: true } 
    });
    
    await prisma.auditLog.create({ 
      data: { 
        userId: req.userId, 
        action: isActive ? 'ACTIVATE' : 'DEACTIVATE', 
        entityType: 'User', 
        entityId: id, 
        oldValues: { isActive: oldUser.isActive }, 
        newValues: { isActive }, 
        ipAddress: req.ip, 
        userAgent: req.get('User-Agent'), 
        description: `${isActive ? 'Activation' : 'Désactivation'} du compte ${oldUser.email}`,
        userType: 'CLIENT'
      } 
    });
    
    res.json(updatedUser);
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/users/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.client.findUnique({ 
      where: { id }, 
      select: { role: true, email: true } 
    });
    
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.client.count({ 
        where: { role: 'ADMIN', isActive: true, id: { not: id } } 
      });
      if (adminCount === 0) {
        return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur' });
      }
    }
    
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    
    await prisma.auditLog.create({ 
      data: { 
        userId: req.userId, 
        action: 'DELETE', 
        entityType: 'User', 
        entityId: id, 
        oldValues: { isActive: true }, 
        newValues: { isActive: false }, 
        ipAddress: req.ip, 
        userAgent: req.get('User-Agent'), 
        description: `Suppression (désactivation) du compte ${user.email}` 
      } 
    });
    
    res.json({ message: 'Utilisateur désactivé' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== EMPLOYÉS ====================


// GET /admin/reports/weekly - Rapport hebdomadaire détaillé
router.get('/reports/weekly', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 jours par défaut
    const end = endDate ? new Date(endDate) : new Date();

    // Récupérer toutes les commandes confirmées dans la période
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'COMPLETED'] }
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                price: true,
                category: {
                  select: { name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Agréger par semaine
    const weeklyData = {};
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalCustomers = new Set();
    let totalItemsSold = 0;

    orders.forEach(order => {
      // Calculer la semaine (ISO week)
      const orderDate = new Date(order.createdAt);
      const weekStart = new Date(orderDate);
      weekStart.setDate(orderDate.getDate() - orderDate.getDay()); // Dimanche de la semaine
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekKey = `Semaine ${weekStart.toISOString().split('T')[0]}`;

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          orders: [],
          customers: new Set(),
          revenue: 0,
          totalOrders: 0,
          totalItems: 0
        };
      }

      weeklyData[weekKey].orders.push(order);
      weeklyData[weekKey].customers.add(order.userId);
      weeklyData[weekKey].revenue += order.total;
      weeklyData[weekKey].totalOrders += 1;
      order.items.forEach(item => {
        weeklyData[weekKey].totalItems += item.quantity;
      });

      totalRevenue += order.total;
      totalOrders += 1;
      totalCustomers.add(order.userId);
      totalItemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    // Détails par client
    const customerDetails = {};
    orders.forEach(order => {
      if (!order.userId) return;

      if (!customerDetails[order.userId]) {
        customerDetails[order.userId] = {
          userId: order.userId,
          firstName: order.client?.firstName,
          lastName: order.client?.lastName,
          email: order.client?.email,
          phone: order.client?.phone,
          totalOrders: 0,
          totalSpent: 0,
          orders: []
        };
      }

      customerDetails[order.userId].totalOrders += 1;
      customerDetails[order.userId].totalSpent += order.total;
      customerDetails[order.userId].orders.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        date: order.createdAt,
        total: order.total,
        status: order.status,
        items: order.items.map(item => ({
          productName: item.product.name,
          brand: item.product.brand,
          category: item.product.category?.name,
          quantity: item.quantity,
          price: item.price
        }))
      });
    });

    // Produits les plus vendus de la période
    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.product.id;
        if (!productStats[key]) {
          productStats[key] = {
            productId: item.product.id,
            productName: item.product.name,
            brand: item.product.brand,
            category: item.product.category?.name,
            quantity: 0,
            revenue: 0
          };
        }
        productStats[key].quantity += item.quantity;
        productStats[key].revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    res.json({
      period: { startDate: start, endDate: end },
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        totalCustomers: totalCustomers.size,
        totalItemsSold,
        averageOrderValue: parseFloat((totalRevenue / (totalOrders || 1)).toFixed(2)),
        averageCustomerSpent: parseFloat((totalRevenue / (totalCustomers.size || 1)).toFixed(2))
      },
      weeklyBreakdown: Object.values(weeklyData).sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
      customerDetails: Object.values(customerDetails).sort((a, b) => b.totalSpent - a.totalSpent),
      topProducts
    });
  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/click-collect - Rapport Click & Collect
router.get('/reports/click-collect', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date('2030-12-31');

    // Récupérer les commandes Click & Collect
    const clickCollectOrders = await prisma.order.findMany({
      where: {
        timeSlotDate: { gte: start, lte: end },
        timeSlotStart: { not: null }
      },
      select: {
        id: true,
        timeSlotDate: true,
        timeSlotStart: true,
        status: true,
        createdAt: true
      }
    });

    // Statistiques par créneau
    const slotStats = {};
    let totalReserved = 0;
    let totalPickedUp = 0;

    clickCollectOrders.forEach(order => {
      const dateStr = order.timeSlotDate.toISOString().split('T')[0];
      const slotKey = `${dateStr}_${order.timeSlotStart}`;

      if (!slotStats[slotKey]) {
        slotStats[slotKey] = {
          date: dateStr,
          time: order.timeSlotStart,
          reserved: 0,
          pickedUp: 0,
          cancelled: 0
        };
      }
      slotStats[slotKey].reserved += 1;
      if (['PICKED_UP', 'DELIVERED'].includes(order.status)) {
        slotStats[slotKey].pickedUp += 1;
        totalPickedUp += 1;
      }
      if (order.status === 'CANCELLED') {
        slotStats[slotKey].cancelled += 1;
      }
      totalReserved += 1;
    });

    // Pic d'activité (heure la plus remplie)
    const timeStats = {};
    clickCollectOrders.forEach(order => {
      const time = order.timeSlotStart;
      if (!timeStats[time]) timeStats[time] = 0;
      timeStats[time] += 1;
    });

    const peakTime = Object.entries(timeStats).sort((a, b) => b[1] - a[1])[0];

    // Pic de jour (jour le plus rempli)
    const dayStats = {};
    clickCollectOrders.forEach(order => {
      const day = order.timeSlotDate.toISOString().split('T')[0];
      if (!dayStats[day]) dayStats[day] = 0;
      dayStats[day] += 1;
    });

    const peakDay = Object.entries(dayStats).sort((a, b) => b[1] - a[1])[0];

    res.json({
      period: { startDate: start, endDate: end },
      summary: {
        totalReserved,
        totalPickedUp,
        pickupRate: totalReserved > 0 ? parseFloat(((totalPickedUp / totalReserved) * 100).toFixed(2)) : 0,
        averagePerSlot: totalReserved > 0 ? parseFloat((totalReserved / Object.keys(slotStats).length).toFixed(2)) : 0
      },
      peakTime: peakTime ? { time: peakTime[0], count: peakTime[1] } : null,
      peakDay: peakDay ? { date: peakDay[0], count: peakDay[1] } : null,
      slotData: Object.values(slotStats).sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))
    });
  } catch (error) {
    console.error('Click & Collect report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/export/:type - Export des rapports
router.get('/reports/export/:type', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'pdf', startDate, endDate } = req.query;

    let reportData;
    let summaryData = null;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Récupérer les données selon le type
    if (type === 'products') {
      // Rapport produit détaillé avec rentabilité (nouveau rapport principal)
      const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

      const products = await prisma.product.findMany({
        include: {
          category: { select: { name: true } },
          orderItems: {
            where: {
              order: {
                createdAt: { gte: start, lte: end },
                status: { in: SALE_STATUSES }
              }
            },
            select: {
              quantity: true,
              price: true,
              order: { select: { id: true } }
            }
          }
        }
      });

      const detailedProducts = await Promise.all(
        products.map(async (product) => {
          const totalQuantitySold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
          const totalRevenue = product.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const totalRevenueWithTax = totalRevenue * 1.20;
          const uniqueOrders = new Set(product.orderItems.map(item => item.order.id)).size;

          const recentPurchase = await prisma.purchaseOrderItem.findFirst({
            where: { productId: product.id },
            orderBy: { createdAt: 'desc' },
            select: { unitPrice: true }
          });
          const purchasePrice = recentPurchase?.unitPrice || 0;

          const unitGrossMargin = product.price - purchasePrice;
          const totalGrossMargin = unitGrossMargin * totalQuantitySold;
          const marginPercentage = product.price > 0 ? ((unitGrossMargin / product.price) * 100) : 0;

          const stockStatus = product.stock <= 0 ? 'Rupture' : 
                             product.stock <= (product.stockAlert || 10) ? 'Alerte' : 'Normal';

          const lastRestock = await prisma.purchaseOrderItem.findFirst({
            where: { 
              productId: product.id,
              purchaseOrder: { status: { in: ['RECEIVED', 'REÇU_TOTAL', 'REÇU_PARTIEL'] } }
            },
            include: {
              purchaseOrder: { select: { receivedDate: true } }
            },
            orderBy: { updatedAt: 'desc' }
          });

          return {
            'Image': product.image || '',
            'Code-barres': product.barcode || product.sku || 'N/A',
            'Nom produit': product.name,
            'Marque': product.brand || 'N/A',
            'Catégorie': product.category?.name || 'N/A',
            'Quantité vendue': totalQuantitySold,
            'Chiffre d\'affaires HT (DH)': totalRevenue.toFixed(2),
            'Chiffre d\'affaires TTC (DH)': totalRevenueWithTax.toFixed(2),
            'Prix d\'achat HT (DH)': purchasePrice.toFixed(2),
            'Prix de vente HT (DH)': product.price.toFixed(2),
            'Marge brute unitaire (DH)': unitGrossMargin.toFixed(2),
            'Marge brute totale (DH)': totalGrossMargin.toFixed(2),
            'Taux de marge (%)': marginPercentage.toFixed(2),
            'Stock actuel': product.stock,
            'Seuil d\'alerte': product.stockAlert || 10,
            'Statut': stockStatus,
            'Dernier réassort': lastRestock?.purchaseOrder?.receivedDate ? 
              new Date(lastRestock.purchaseOrder.receivedDate).toLocaleDateString('fr-FR') : 'Jamais'
          };
        })
      );

      reportData = detailedProducts
        .filter(p => p['Quantité vendue'] > 0) // Seulement les produits vendus
        .sort((a, b) => parseFloat(b['Chiffre d\'affaires HT (DH)']) - parseFloat(a['Chiffre d\'affaires HT (DH)']));

      // Résumé pour le rapport principal
      summaryData = {
        'Produits vendus': reportData.length,
        'CA Total HT (DH)': reportData.reduce((sum, p) => sum + parseFloat(p['Chiffre d\'affaires HT (DH)']), 0).toFixed(2),
        'CA Total TTC (DH)': reportData.reduce((sum, p) => sum + parseFloat(p['Chiffre d\'affaires TTC (DH)']), 0).toFixed(2),
        'Quantité totale vendue': reportData.reduce((sum, p) => sum + p['Quantité vendue'], 0),
        'Marge brute totale (DH)': reportData.reduce((sum, p) => sum + parseFloat(p['Marge brute totale (DH)']), 0).toFixed(2)
      };
    } else if (type === 'top-products') {
      const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];
      
      // Récupérer tous les items de commande dans la période
      const orderItems = await prisma.orderItem.findMany({
        where: {
          order: {
            createdAt: { gte: start, lte: end },
            status: { in: SALE_STATUSES }
          }
        },
        include: {
          product: { 
            select: { 
              id: true,
              name: true, 
              brand: true,
              image: true,
              sku: true
            } 
          },
          order: {
            select: { id: true }
          }
        }
      });

      const productStats = {};
      orderItems.forEach(item => {
        if (!item.product) return;
        const pid = item.product.id;
        if (!productStats[pid]) {
          productStats[pid] = {
            'Image': item.product.image || '',
            'Produit': item.product.name,
            'Marque': item.product.brand || 'N/A',
            'Code produit': item.product.sku || 'N/A',
            'Quantité vendue': 0,
            'Chiffre d\'affaires (DH)': 0,
            'Nombre de commandes': new Set()
          };
        }
        productStats[pid]['Quantité vendue'] += item.quantity;
        productStats[pid]['Chiffre d\'affaires (DH)'] += item.price * item.quantity;
        productStats[pid]['Nombre de commandes'].add(item.order.id);
      });

      // Convertir les Sets en nombres et formater
      Object.values(productStats).forEach(product => {
        product['Nombre de commandes'] = product['Nombre de commandes'].size;
        product['Chiffre d\'affaires (DH)'] = product['Chiffre d\'affaires (DH)'].toFixed(2);
      });

      reportData = Object.values(productStats)
        .filter(p => p['Quantité vendue'] > 0) // Seulement les produits vendus
        .sort((a, b) => b['Quantité vendue'] - a['Quantité vendue'])
        .slice(0, 20); // Top 20
    } else if (type === 'bottom-products') {
      const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];
      
      // Récupérer tous les produits avec leurs ventes
      const products = await prisma.product.findMany({
        include: {
          orderItems: {
            where: {
              order: {
                createdAt: { gte: start, lte: end },
                status: { in: SALE_STATUSES }
              }
            },
            select: {
              quantity: true,
              order: { select: { id: true } }
            }
          }
        }
      });

      const productStats = products.map(product => {
        const totalQuantitySold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const uniqueOrders = new Set(product.orderItems.map(item => item.order.id)).size;
        
        return {
          'Image': product.image || '',
          'Produit': product.name,
          'Marque': product.brand || 'N/A',
          'Code produit': product.sku || 'N/A',
          'Quantité vendue': totalQuantitySold,
          'Nombre de commandes': uniqueOrders,
          'Stock actuel': product.stock,
          'Statut': totalQuantitySold === 0 ? 'Jamais vendu' : 'Faibles ventes'
        };
      });

      reportData = productStats
        .sort((a, b) => {
          // Prioriser les produits jamais vendus, puis par quantité croissante
          if (a['Quantité vendue'] === 0 && b['Quantité vendue'] > 0) return -1;
          if (a['Quantité vendue'] > 0 && b['Quantité vendue'] === 0) return 1;
          return a['Quantité vendue'] - b['Quantité vendue'];
        })
        .slice(0, 20); // Bottom 20
    } else if (type === 'click-collect') {
      const clickCollectOrders = await prisma.order.findMany({
        where: {
          timeSlotDate: { gte: start, lte: end },
          timeSlotStart: { not: null }
        },
        select: {
          timeSlotDate: true,
          timeSlotStart: true,
          status: true
        }
      });

      const slotStats = {};
      clickCollectOrders.forEach(order => {
        const dateStr = order.timeSlotDate.toISOString().split('T')[0];
        const slotKey = `${dateStr}_${order.timeSlotStart}`;
        if (!slotStats[slotKey]) {
          slotStats[slotKey] = {
            'Date': dateStr,
            'Heure': order.timeSlotStart,
            'Réservées': 0,
            'Retirées': 0,
            'Annulées': 0
          };
        }
        slotStats[slotKey]['Réservées'] += 1;
        if (['PICKED_UP', 'DELIVERED'].includes(order.status)) {
          slotStats[slotKey]['Retirées'] += 1;
        }
        if (order.status === 'CANCELLED') {
          slotStats[slotKey]['Annulées'] += 1;
        }
      });

      // Ajouter le taux de retrait pour chaque créneau
      Object.values(slotStats).forEach(slot => {
        const pickupRate = slot['Réservées'] > 0 
          ? ((slot['Retirées'] / slot['Réservées']) * 100).toFixed(1) 
          : 0;
        slot['Taux de retrait %'] = `${pickupRate}%`;
      });

      reportData = Object.values(slotStats);
    } else if (type === 'products-detailed') {
      // Rapport produit détaillé avec rentabilité
      const { productId } = req.query;
      const whereProduct = productId ? { id: productId } : {};
      const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

      const products = await prisma.product.findMany({
        where: whereProduct,
        include: {
          category: { select: { name: true } },
          orderItems: {
            where: {
              order: {
                createdAt: { gte: start, lte: end },
                status: { in: SALE_STATUSES }
              }
            },
            select: {
              quantity: true,
              price: true,
              order: { select: { id: true } }
            }
          }
        }
      });

      const detailedProducts = await Promise.all(
        products.map(async (product) => {
          const totalQuantitySold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
          const totalRevenue = product.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const totalRevenueWithTax = totalRevenue * 1.20;
          const uniqueOrders = new Set(product.orderItems.map(item => item.order.id)).size;

          const recentPurchase = await prisma.purchaseOrderItem.findFirst({
            where: { productId: product.id },
            orderBy: { createdAt: 'desc' },
            select: { unitPrice: true }
          });
          const purchasePrice = recentPurchase?.unitPrice || 0;

          const unitGrossMargin = product.price - purchasePrice;
          const totalGrossMargin = unitGrossMargin * totalQuantitySold;
          const marginPercentage = product.price > 0 ? ((unitGrossMargin / product.price) * 100) : 0;

          const stockStatus = product.stock <= 0 ? 'Rupture' : 
                             product.stock <= (product.stockAlert || 10) ? 'Alerte' : 'Normal';

          const lastRestock = await prisma.purchaseOrderItem.findFirst({
            where: { 
              productId: product.id,
              purchaseOrder: { status: { in: ['RECEIVED', 'REÇU_TOTAL', 'REÇU_PARTIEL'] } }
            },
            include: {
              purchaseOrder: { select: { receivedDate: true } }
            },
            orderBy: { updatedAt: 'desc' }
          });

          return {
            'Code-barres': product.barcode || product.sku || 'N/A',
            'Nom produit': product.name,
            'Marque': product.brand || 'N/A',
            'Catégorie': product.category?.name || 'N/A',
            'Quantité vendue': totalQuantitySold,
            'Chiffre d\'affaires HT (DH)': totalRevenue.toFixed(2),
            'Chiffre d\'affaires TTC (DH)': totalRevenueWithTax.toFixed(2),
            'Prix d\'achat HT (DH)': purchasePrice.toFixed(2),
            'Prix de vente HT (DH)': product.price.toFixed(2),
            'Marge brute unitaire (DH)': unitGrossMargin.toFixed(2),
            'Marge brute totale (DH)': totalGrossMargin.toFixed(2),
            'Taux de marge (%)': marginPercentage.toFixed(2),
            'Stock actuel': product.stock,
            'Seuil d\'alerte': product.stockAlert || 10,
            'Statut': stockStatus,
            'Dernier réassort': lastRestock?.purchaseOrder?.receivedDate ? 
              new Date(lastRestock.purchaseOrder.receivedDate).toLocaleDateString('fr-FR') : 'Jamais'
          };
        })
      );

      reportData = detailedProducts
        .filter(p => p['Quantité vendue'] > 0 || productId)
        .sort((a, b) => parseFloat(b['Chiffre d\'affaires HT (DH)']) - parseFloat(a['Chiffre d\'affaires HT (DH)']));

      // Résumé pour le rapport détaillé
      summaryData = {
        'Produits analysés': reportData.length,
        'CA Total HT (DH)': reportData.reduce((sum, p) => sum + parseFloat(p['Chiffre d\'affaires HT (DH)']), 0).toFixed(2),
        'CA Total TTC (DH)': reportData.reduce((sum, p) => sum + parseFloat(p['Chiffre d\'affaires TTC (DH)']), 0).toFixed(2),
        'Quantité totale vendue': reportData.reduce((sum, p) => sum + p['Quantité vendue'], 0),
        'Marge brute totale (DH)': reportData.reduce((sum, p) => sum + parseFloat(p['Marge brute totale (DH)']), 0).toFixed(2)
      };
    } else {
      return res.status(400).json({ message: 'Type de rapport non supporté' });
    }

    if (format === 'pdf') {
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ 
        margin: 20,
        size: 'A4',
        layout: 'landscape', // Mode paysage pour plus d'espace
        autoFirstPage: true
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport_${type}_${Date.now()}.pdf"`);
      
      doc.pipe(res);
      
      // Titre
      doc.fillColor('#1f2937').fontSize(20).font('Helvetica-Bold').text(`Rapport ${type.toUpperCase()}`, { align: 'center' });
      doc.moveDown(0.5);
      
      // Période
      doc.fillColor('#374151').fontSize(12).font('Helvetica').text(`Période: ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`, { align: 'center' });
      doc.moveDown(1);
      
      // Résumé des ventes (si disponible)
      if (summaryData) {
        doc.fillColor('#1f2937').fontSize(14).font('Helvetica-Bold').text('Résumé Global', { underline: true });
        doc.moveDown(0.3);
        
        // Afficher le résumé en colonnes
        const summaryEntries = Object.entries(summaryData);
        const cols = 2;
        const colWidth = 250;
        
        summaryEntries.forEach(([key, value], index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = 50 + (col * colWidth);
          const y = doc.y + (row * 20) - (index >= cols ? (Math.floor(index / cols) * 20) : 0);
          
          if (col === 0 && index >= cols) {
            doc.moveDown(0.8);
          }
          
          doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold').text(`${key}:`, x, y);
          doc.fillColor('#1f2937').fontSize(10).font('Helvetica').text(`${value}`, x + 120, y);
        });
        
        doc.moveDown(2);
      }
      
      // Nombre de résultats
      doc.fillColor('#6b7280').fontSize(10).text(`Total: ${reportData.length} enregistrements`);
      doc.moveDown(0.5);
      
      // Tableau des données optimisé pour le rapport détaillé
      if (reportData.length > 0) {
        const headers = Object.keys(reportData[0]);
        
        // Configuration spéciale pour le rapport détaillé
        if (type === 'products' || type === 'products-detailed') {
          // Colonnes prioritaires pour le rapport principal
          const priorityColumns = [
            'Nom produit',
            'Marque', 
            'Quantité vendue',
            'Chiffre d\'affaires HT (DH)',
            'Marge brute totale (DH)',
            'Taux de marge (%)',
            'Stock actuel',
            'Statut'
          ];
          
          const selectedHeaders = priorityColumns.filter(h => headers.includes(h));
          const tableTop = doc.y;
          const tableLeft = 20;
          const tableWidth = 800; // Mode paysage
          const rowHeight = 25;
          const colWidth = tableWidth / selectedHeaders.length;
          
          // En-têtes avec style amélioré
          doc.fillColor('#1f2937').fontSize(9).font('Helvetica-Bold');
          selectedHeaders.forEach((header, i) => {
            const x = tableLeft + (i * colWidth);
            doc.rect(x, tableTop, colWidth, rowHeight).fill('#f3f4f6').stroke('#d1d5db');
            
            // Texte centré dans l'en-tête
            const textWidth = doc.widthOfString(header);
            const textX = x + (colWidth - textWidth) / 2;
            doc.fillColor('#1f2937').text(header, textX, tableTop + 8, { width: colWidth - 4, align: 'center' });
          });
          
          // Données avec alternance de couleurs - TOUS LES PRODUITS
          doc.font('Helvetica').fontSize(8);
          let currentY = tableTop + rowHeight;
          let pageItemCount = 0;
          const itemsPerPage = 20; // Réduit pour avoir plus d'espace
          
          reportData.forEach((row, rowIndex) => {
            // Vérifier si on doit créer une nouvelle page
            if (pageItemCount >= itemsPerPage || currentY + rowHeight > 550) {
              doc.addPage();
              currentY = 50;
              pageItemCount = 0;
              
              // Répéter les en-têtes sur la nouvelle page
              doc.fillColor('#1f2937').fontSize(9).font('Helvetica-Bold');
              selectedHeaders.forEach((header, i) => {
                const x = tableLeft + (i * colWidth);
                doc.rect(x, currentY, colWidth, rowHeight).fill('#f3f4f6').stroke('#d1d5db');
                const textWidth = doc.widthOfString(header);
                const textX = x + (colWidth - textWidth) / 2;
                doc.fillColor('#1f2937').text(header, textX, currentY + 8, { width: colWidth - 4, align: 'center' });
              });
              currentY += rowHeight;
              doc.font('Helvetica').fontSize(8);
            }
            
            // Couleur alternée pour les lignes
            const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
            doc.rect(tableLeft, currentY, tableWidth, rowHeight).fill(bgColor).stroke('#e5e7eb');
            
            selectedHeaders.forEach((header, colIndex) => {
              const x = tableLeft + (colIndex * colWidth);
              let value = String(row[header] || '');
              
              // Formatage spécial pour certaines colonnes
              if (header.includes('DH') || header.includes('%')) {
                doc.fillColor('#059669'); // Vert pour les montants
              } else if (header === 'Statut') {
                if (value === 'Rupture') doc.fillColor('#dc2626'); // Rouge
                else if (value === 'Alerte') doc.fillColor('#d97706'); // Orange
                else doc.fillColor('#059669'); // Vert
              } else {
                doc.fillColor('#374151'); // Gris foncé par défaut
              }
              
              // Tronquer le texte si trop long
              if (value.length > 15 && !header.includes('DH') && !header.includes('%')) {
                value = value.substring(0, 12) + '...';
              }
              
              // Alignement selon le type de donnée
              const align = header.includes('DH') || header.includes('%') || header.includes('Quantité') || header.includes('Stock') ? 'right' : 'left';
              const textX = align === 'right' ? x + colWidth - 10 : x + 5;
              
              doc.text(value, textX, currentY + 8, { width: colWidth - 10, align });
            });
            
            currentY += rowHeight;
            pageItemCount++;
          });
          
        } else if (type === 'top-products' || type === 'bottom-products') {
          // Configuration pour top/bottom products avec images
          const productColumns = [
            'Produit',
            'Marque',
            'Quantité vendue',
            'Chiffre d\'affaires (DH)',
            'Nombre de commandes'
          ];
          
          if (type === 'bottom-products') {
            productColumns.push('Statut');
          }
          
          const selectedHeaders = productColumns.filter(h => headers.includes(h));
          const tableTop = doc.y;
          const tableLeft = 20;
          const tableWidth = 800;
          const rowHeight = 30; // Plus haut pour les images
          const colWidth = tableWidth / selectedHeaders.length;
          
          // En-têtes
          doc.fillColor('#1f2937').fontSize(9).font('Helvetica-Bold');
          selectedHeaders.forEach((header, i) => {
            const x = tableLeft + (i * colWidth);
            doc.rect(x, tableTop, colWidth, rowHeight).fill('#f3f4f6').stroke('#d1d5db');
            const textWidth = doc.widthOfString(header);
            const textX = x + (colWidth - textWidth) / 2;
            doc.fillColor('#1f2937').text(header, textX, tableTop + 10, { width: colWidth - 4, align: 'center' });
          });
          
          // Données
          doc.font('Helvetica').fontSize(8);
          let currentY = tableTop + rowHeight;
          let pageItemCount = 0;
          const itemsPerPage = 15;
          
          reportData.forEach((row, rowIndex) => {
            if (pageItemCount >= itemsPerPage || currentY + rowHeight > 520) {
              doc.addPage();
              currentY = 50;
              pageItemCount = 0;
              
              // Répéter les en-têtes
              doc.fillColor('#1f2937').fontSize(9).font('Helvetica-Bold');
              selectedHeaders.forEach((header, i) => {
                const x = tableLeft + (i * colWidth);
                doc.rect(x, currentY, colWidth, rowHeight).fill('#f3f4f6').stroke('#d1d5db');
                const textWidth = doc.widthOfString(header);
                const textX = x + (colWidth - textWidth) / 2;
                doc.fillColor('#1f2937').text(header, textX, currentY + 10, { width: colWidth - 4, align: 'center' });
              });
              currentY += rowHeight;
              doc.font('Helvetica').fontSize(8);
            }
            
            const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb';
            doc.rect(tableLeft, currentY, tableWidth, rowHeight).fill(bgColor).stroke('#e5e7eb');
            
            selectedHeaders.forEach((header, colIndex) => {
              const x = tableLeft + (colIndex * colWidth);
              let value = String(row[header] || '');
              
              // Couleurs spéciales
              if (header.includes('DH') || header.includes('Quantité') || header.includes('commandes')) {
                doc.fillColor('#059669');
              } else if (header === 'Statut') {
                if (value === 'Jamais vendu') doc.fillColor('#dc2626');
                else doc.fillColor('#d97706');
              } else {
                doc.fillColor('#374151');
              }
              
              if (value.length > 20) {
                value = value.substring(0, 17) + '...';
              }
              
              const align = header.includes('DH') || header.includes('Quantité') || header.includes('commandes') ? 'right' : 'left';
              const textX = align === 'right' ? x + colWidth - 10 : x + 5;
              
              doc.text(value, textX, currentY + 10, { width: colWidth - 10, align });
            });
            
            currentY += rowHeight;
            pageItemCount++;
          });
          
        } else {
          // Tableau standard pour les autres rapports
          const tableTop = doc.y;
          const tableLeft = 20;
          const tableWidth = 800;
          const rowHeight = 20;
          const colWidth = Math.min(120, tableWidth / headers.length);
          
          // En-têtes
          doc.fillColor('#1f2937').fontSize(9).font('Helvetica-Bold');
          headers.forEach((header, i) => {
            const x = tableLeft + (i * colWidth);
            doc.rect(x, tableTop, colWidth, rowHeight).fill('#f3f4f6').stroke('#d1d5db');
            doc.fillColor('#1f2937').text(header, x + 3, tableTop + 6, { width: colWidth - 6, align: 'left' });
          });
          
          // Données
          doc.fillColor('#374151').font('Helvetica').fontSize(8);
          let currentY = tableTop + rowHeight;
          
          reportData.slice(0, 30).forEach((row, rowIndex) => {
            if (currentY + rowHeight > 550) {
              doc.addPage();
              currentY = 50;
            }
            
            headers.forEach((header, colIndex) => {
              const x = tableLeft + (colIndex * colWidth);
              const value = String(row[header] || '');
              doc.text(value.length > 15 ? value.substring(0, 12) + '...' : value, x + 3, currentY + 6, { width: colWidth - 6, align: 'left' });
            });
            
            currentY += rowHeight;
          });
        }
      } else {
        doc.fillColor('#6b7280').fontSize(12).text('Aucune donnée disponible pour cette période.', { align: 'center' });
      }
      
      // Pied de page
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fillColor('#9ca3af').fontSize(8).text(
          `Page ${i + 1} sur ${pageCount} - Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
          20, 570, { align: 'center', width: 800 }
        );
      }
      
      doc.end();
    } else {
      // Format par défaut JSON pour compatibilité
      res.header('Content-Type', 'application/json; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename="rapport_${type}_${Date.now()}.json"`);
      const exportData = summaryData ? { summary: summaryData, data: reportData } : reportData;
      res.send(JSON.stringify(exportData, null, 2));
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DES SOUS-CATÉGORIES =====

// GET /admin/categories/subcategories - Récupérer toutes les sous-catégories avec leurs items
router.get('/categories/subcategories', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 20, categoryId, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Construire les filtres
    const where = {};
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const [subcategories, total] = await Promise.all([
      prisma.subcategory.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true }
          },
          items: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: [
          { categoryId: 'asc' },
          { order: 'asc' }
        ],
        skip,
        take: parseInt(limit)
      }),
      prisma.subcategory.count({ where })
    ]);

    res.json({
      subcategories,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get subcategories error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /admin/categories/subcategories - Créer une sous-catégorie
router.post('/categories/subcategories', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { title, icon, categoryId, order } = req.body;

    // Validation
    if (!title || !categoryId) {
      return res.status(400).json({ message: 'Titre et catégorie requis' });
    }

    // Vérifier que la catégorie existe
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }

    // Créer la sous-catégorie
    const subcategory = await prisma.subcategory.create({
      data: {
        title,
        icon: icon || null,
        categoryId,
        order: order || 0
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        items: true
      }
    });

    res.status(201).json({ message: 'Sous-catégorie créée', subcategory });
  } catch (error) {
    console.error('Create subcategory error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Cette sous-catégorie existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/categories/subcategories/:id - Modifier une sous-catégorie
router.put('/categories/subcategories/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, icon, order } = req.body;

    // Vérifier que la sous-catégorie existe
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true }
        }
      }
    });

    if (!subcategory) {
      return res.status(404).json({ message: 'Sous-catégorie non trouvée' });
    }

    // Mettre à jour la sous-catégorie
    const updatedSubcategory = await prisma.subcategory.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order })
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        items: true
      }
    });

    res.json({ message: 'Sous-catégorie modifiée', subcategory: updatedSubcategory });
  } catch (error) {
    console.error('Update subcategory error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/categories/subcategories/:id - Supprimer une sous-catégorie
router.delete('/categories/subcategories/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la sous-catégorie existe
    const subcategory = await prisma.subcategory.findUnique({
      where: { id }
    });

    if (!subcategory) {
      return res.status(404).json({ message: 'Sous-catégorie non trouvée' });
    }

    // Supprimer les items associés d'abord
    await prisma.subcategoryItem.deleteMany({
      where: { subcategoryId: id }
    });

    // Supprimer la sous-catégorie
    await prisma.subcategory.delete({
      where: { id }
    });

    res.json({ message: 'Sous-catégorie supprimée' });
  } catch (error) {
    console.error('Delete subcategory error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/categories/subcategories/:id - Récupérer une sous-catégorie
router.get('/categories/subcategories/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true }
        },
        items: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!subcategory) {
      return res.status(404).json({ message: 'Sous-catégorie non trouvée' });
    }

    res.json(subcategory);
  } catch (error) {
    console.error('Get subcategory error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DES ITEMS DE SOUS-CATÉGORIES =====

// POST /admin/categories/subcategories/:id/items - Ajouter un item à une sous-catégorie
router.post('/categories/subcategories/:id/items', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, order } = req.body;

    // Vérifier que la sous-catégorie existe
    const subcategory = await prisma.subcategory.findUnique({
      where: { id }
    });

    if (!subcategory) {
      return res.status(404).json({ message: 'Sous-catégorie non trouvée' });
    }

    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Nom de l\'item requis' });
    }

    // Créer l'item
    const item = await prisma.subcategoryItem.create({
      data: {
        name,
        subcategoryId: id,
        order: order || 0
      }
    });

    res.status(201).json({ message: 'Item ajouté', item });
  } catch (error) {
    console.error('Create item error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/categories/items/:id - Modifier un item
router.put('/categories/items/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, order } = req.body;

    // Vérifier que l'item existe
    const item = await prisma.subcategoryItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item non trouvé' });
    }

    // Validation
    if (!name) {
      return res.status(400).json({ message: 'Nom de l\'item requis' });
    }

    // Mettre à jour l'item
    const updatedItem = await prisma.subcategoryItem.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(order !== undefined && { order })
      }
    });

    res.json({ message: 'Item modifié', item: updatedItem });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/categories/items/:id - Supprimer un item
router.delete('/categories/items/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'item existe
    const item = await prisma.subcategoryItem.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item non trouvé' });
    }

    // Supprimer l'item
    await prisma.subcategoryItem.delete({
      where: { id }
    });

    res.json({ message: 'Item supprimé' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DES UTILISATEURS =====

// GET /admin/users - Liste des utilisateurs avec filtres et pagination
router.get('/users', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Construire les filtres
    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } }
      ];
    }
    if (role && role !== 'ALL') {
    }
    if (status && status !== 'ALL') {
      where.isActive = status === 'ACTIVE';
    }

    // Gérer le tri spécial par nombre de commandes
    let orderByClause;
    if (sortBy === 'orderCount') {
      orderByClause = { orders: { _count: sortOrder } };
    } else {
      orderByClause = { [sortBy]: sortOrder };
    }

    // Récupérer les utilisateurs
    const [users, total] = await Promise.all([
      prisma.client.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              orders: true
            }
          }
        },
        orderBy: orderByClause,
        skip,
        take: parseInt(limit)
      }),
      prisma.client.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/users/:id - Détails d'un utilisateur avec historique
router.get('/users/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        profileImage: true,
        notificationEmail: true,
        notificationSMS: true,
        notificationPush: true,
        role: true,
        isActive: true,
        cart: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            orders: true,
            favorites: true
          }
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            timeSlotDate: true,
            timeSlotStart: true,
            createdAt: true,
            items: {
              select: {
                quantity: true,
                price: true,
                product: {
                  select: { name: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/users/:id - Modifier un utilisateur
router.put('/users/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      phone,
      address,
      role,
      isActive,
      notificationEmail,
      notificationSMS,
      notificationPush
    } = req.body;

    // Récupérer l'utilisateur avant modification pour l'audit
    const oldUser = await prisma.client.findUnique({
      where: { id },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        role: true,
        isActive: true,
        notificationEmail: true,
        notificationSMS: true,
        notificationPush: true
      }
    });

    if (!oldUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await prisma.client.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(notificationEmail !== undefined && { notificationEmail }),
        ...(notificationSMS !== undefined && { notificationSMS }),
        ...(notificationPush !== undefined && { notificationPush })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    // Créer une entrée dans le journal d'audit
    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'UPDATE',
        entityType: 'User',
        entityId: id,
        oldValues: oldUser,
        newValues: {
          firstName,
          lastName,
          phone,
          address,
          role,
          isActive,
          notificationEmail,
          notificationSMS,
          notificationPush
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `Modification de l'utilisateur ${updatedUser.email}`
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/users/:id/status - Activer/Désactiver un compte
router.put('/users/:id/status', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Le statut doit être un booléen' });
    }

    // Récupérer l'utilisateur avant modification
    const oldUser = await prisma.client.findUnique({
      where: { id },
      select: { isActive: true, email: true }
    });

    if (!oldUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Mettre à jour le statut
    const updatedUser = await prisma.client.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        isActive: true,
        updatedAt: true
      }
    });

    // Créer une entrée dans le journal d'audit
    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
        entityType: 'User',
        entityId: id,
        oldValues: { isActive: oldUser.isActive },
        newValues: { isActive },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        userType: 'CLIENT',
        description: `${isActive ? 'Activation' : 'Désactivation'} du compte ${oldUser.email}`
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/users/:id - Supprimer un utilisateur (soft delete en désactivant)
router.delete('/users/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que ce n'est pas le dernier admin
    const user = await prisma.client.findUnique({
      where: { id },
      select: { role: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.client.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } }
      });
      if (adminCount === 0) {
        return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur' });
      }
    }

    // Désactiver l'utilisateur au lieu de le supprimer
    await prisma.client.update({
      where: { id },
      data: { isActive: false }
    });

    // Créer une entrée dans le journal d'audit
    await prisma.auditLog.create({
      data: {
        userId: req.userId,
        action: 'DELETE',
        entityType: 'User',
        entityId: id,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        description: `Suppression (désactivation) du compte ${user.email}`
      }
    });

    res.json({ message: 'Utilisateur désactivé' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /admin/employees - Créer un nouveau employé avec permissions personnalisées
router.post('/employees', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, password, permissions, salary } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    const existingUser = await prisma.employee.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        phone: phone || null,
        email,
        password: hashedPassword,
        isActive: true,
        salary: salary ? parseFloat(salary) : null
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        isActive: true,
        salary: true,
        createdAt: true
      }
    });

    const availableModules = [
      'products', 'orders', 'reports', 'promotions',
      'timeslots', 'suppliers', 'categories', 'customers',
      'inventory', 'settings', 'employees', 'reviews', 'deliveries', 'purchase_orders'
    ];
    
    const createdPermissions = {};
    for (const module of availableModules) {
      const permData = permissions?.[module] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
      const permission = await prisma.employeePermission.create({
        data: {
          employeeId: employee.id,
          module,
          canView: permData.canView || false,
          canCreate: permData.canCreate || false,
          canEdit: permData.canEdit || false,
          canDelete: permData.canDelete || false
        }
      });
      createdPermissions[module] = { canView: permission.canView, canCreate: permission.canCreate, canEdit: permission.canEdit, canDelete: permission.canDelete };
    }

    res.status(201).json({ 
      message: 'Employé créé avec succès avec permissions personnalisées', 
      employee: {
        ...employee,
        permissions: createdPermissions
      }
    });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/employees - Liste des employés
router.get('/employees', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/employees/:id - Modifier un employé
router.put('/employees/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, isActive } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id }, select: { email: true } });
    if (!employee) return res.status(404).json({ message: 'Employé non trouvé' });

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive })
      },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, isActive: true, updatedAt: true }
    });

    res.json({ message: 'Employé mis à jour', employee: updatedEmployee });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/employees/:id - Désactiver un employé
router.delete('/employees/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({ where: { id }, select: { email: true } });
    if (!employee) return res.status(404).json({ message: 'Employé non trouvé' });

    await prisma.employee.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Employé désactivé' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/employees/:id/permissions
router.get('/employees/:id/permissions', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({ where: { id }, select: { firstName: true, lastName: true, email: true } });
    if (!employee) return res.status(404).json({ message: 'Employé non trouvé' });

    const permissions = await prisma.employeePermission.findMany({ where: { employeeId: id }, orderBy: { module: 'asc' } });
    const permissionsMap = {};
    permissions.forEach(p => { permissionsMap[p.module] = { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete }; });

    res.json({ userId: id, user: employee, permissions: permissionsMap });
  } catch (error) {
    console.error('Get employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/employees/:id/permissions
router.put('/employees/:id/permissions', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const employee = await prisma.employee.findUnique({ where: { id }, select: { email: true } });
    if (!employee) return res.status(404).json({ message: 'Employé non trouvé' });

    const availableModules = ['products', 'orders', 'reports', 'promotions', 'timeslots', 'suppliers', 'categories', 'customers', 'inventory', 'settings', 'employees', 'reviews', 'deliveries', 'purchase_orders'];

    for (const module of availableModules) {
      const permData = permissions[module] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
      await prisma.employeePermission.upsert({
        where: { employeeId_module: { employeeId: id, module } },
        update: { canView: permData.canView, canCreate: permData.canCreate, canEdit: permData.canEdit, canDelete: permData.canDelete },
        create: { employeeId: id, module, canView: permData.canView, canCreate: permData.canCreate, canEdit: permData.canEdit, canDelete: permData.canDelete }
      });
    }

    const updatedPermissions = await prisma.employeePermission.findMany({ where: { employeeId: id }, orderBy: { module: 'asc' } });
    const permissionsMap = {};
    updatedPermissions.forEach(p => { permissionsMap[p.module] = { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete }; });

    res.json({ message: 'Permissions mises à jour', permissions: permissionsMap });
  } catch (error) {
    console.error('Update employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/employees/permissions/modules - Lister tous les modules disponibles avec descriptions
router.get('/employees/permissions/modules', verifyAdmin, autoCheckEmployeePermission, (req, res) => {
  const modules = [
    {
      key: 'products',
      label: 'Produits',
      description: 'Gestion du catalogue produits (ajout, modification, suppression, visualisation)'
    },
    {
      key: 'orders',
      label: 'Commandes',
      description: 'Gestion des commandes clients (consultation, modification de statut)'
    },
    {
      key: 'reports',
      label: 'Rapports',
      description: 'Accès aux rapports statistiques et analyses'
    },
    {
      key: 'promotions',
      label: 'Promotions',
      description: 'Gestion des promotions et codes promo'
    },
    {
      key: 'timeslots',
      label: 'Créneaux horaires',
      description: 'Gestion des créneaux de retrait et calendrier'
    },
    {
      key: 'suppliers',
      label: 'Fournisseurs',
      description: 'Gestion des fournisseurs et commandes fournisseurs'
    },
    {
      key: 'categories',
      label: 'Catégories',
      description: 'Gestion des catégories et sous-catégories'
    },
    {
      key: 'customers',
      label: 'Clients',
      description: 'Gestion des comptes clients'
    },
    {
      key: 'inventory',
      label: 'Inventaire',
      description: 'Gestion des stocks et mouvements'
    },
    {
      key: 'settings',
      label: 'Paramètres',
      description: 'Configuration générale du système'
    },
    {
      key: 'employees',
      label: 'Employés',
      description: 'Gestion des comptes employés et permissions'
    },
    {
      key: 'reviews',
      label: 'Avis clients',
      description: 'Modération et gestion des avis produits'
    },
    {
      key: 'deliveries',
      label: 'Livraisons',
      description: 'Gestion des zones et horaires de livraison'
    },
    {
      key: 'purchase_orders',
      label: 'Bons de commande',
      description: 'Generation et gestion des bons de commande fournisseurs'
    }
  ];

  res.json(modules);
});

// GET /admin/audit-logs - Journal d'activite (audit log)
router.get('/audit-logs', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, entityType, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          employee: { select: { id: true, email: true, firstName: true, lastName: true } },
          admin:    { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    // Normaliser : ajouter un champ "user" unifie
    const normalizedLogs = logs.map(log => ({
      ...log,
      user: log.employee || log.admin || null
    }));

    res.json({
      logs: normalizedLogs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get audit logs error:', error.message);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});


// GET /admin/audit-logs/stats - Statistiques du journal d'audit
router.get('/audit-logs/stats', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Statistiques par action
    const actionStats = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: startDate } },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } }
    });

    // Statistiques par type d'entité
    const entityStats = await prisma.auditLog.groupBy({
      by: ['entityType'],
      where: { createdAt: { gte: startDate } },
      _count: { entityType: true },
      orderBy: { _count: { entityType: 'desc' } }
    });

    // Statistiques par utilisateur
    const userStats = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: startDate } },
      _count: { userId: true },
      include: {
        client: {
          select: { email: true, firstName: true, lastName: true }
        }
      },
      orderBy: { _count: { userId: 'desc' } },
      take: 10
    });

    res.json({
      actionStats,
      entityStats,
      userStats,
      period: { days: parseInt(days), startDate }
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});
// ==================== REPORTS ====================
router.get('/reports/sales', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date('2030-12-31');
    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: SALE_STATUSES }
      },
      select: { createdAt: true, total: true, status: true }
    });

    let salesData;
    if (period === 'monthly') {
      salesData = {};
      orders.forEach(order => {
        const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
        if (!salesData[key]) salesData[key] = { period: key, revenue: 0, orders: 0 };
        salesData[key].revenue += order.total;
        salesData[key].orders += 1;
      });
    } else if (period === 'weekly') {
      salesData = {};
      orders.forEach(order => {
        const weekStart = new Date(order.createdAt);
        weekStart.setDate(order.createdAt.getDate() - order.createdAt.getDay());
        const key = weekStart.toISOString().split('T')[0];
        if (!salesData[key]) salesData[key] = { period: key, revenue: 0, orders: 0 };
        salesData[key].revenue += order.total;
        salesData[key].orders += 1;
      });
    } else {
      salesData = {};
      orders.forEach(order => {
        const key = order.createdAt.toISOString().split('T')[0];
        if (!salesData[key]) salesData[key] = { period: key, revenue: 0, orders: 0 };
        salesData[key].revenue += order.total;
        salesData[key].orders += 1;
      });
    }

    const result = Object.values(salesData).sort((a, b) => a.period.localeCompare(b.period));
    const totalRevenue = result.reduce((sum, item) => sum + item.revenue, 0);
    const totalOrders = result.reduce((sum, item) => sum + item.orders, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    res.json({
      summary: { totalRevenue, totalOrders, averageOrderValue },
      data: result
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/reports/products', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date('2030-12-31');
    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { in: SALE_STATUSES }
        }
      },
      include: {
        product: { select: { name: true, sku: true, image: true, brand: true } }
      }
    });

    const productStats = {};
    orderItems.forEach(item => {
      if (!item.product) return;
      const pid = item.productId;
      if (!productStats[pid]) {
        productStats[pid] = {
          productId: pid,
          name: item.product.name,
          sku: item.product.sku,
          image: item.product.image,
          brand: item.product.brand,
          quantity: 0,
          revenue: 0
        };
      }
      productStats[pid].quantity += item.quantity;
      productStats[pid].revenue += item.price * item.quantity;
    });

    const result = Object.values(productStats).sort((a, b) => b.quantity - a.quantity);
    res.json(result);
  } catch (error) {
    console.error('Products report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/products-detailed - Rapport produit détaillé avec rentabilité
router.get('/reports/products-detailed', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    // Si un produit spécifique est demandé
    const whereProduct = productId ? { id: productId } : {};

    // Récupérer tous les produits avec leurs informations complètes
    const products = await prisma.product.findMany({
      where: whereProduct,
      include: {
        category: { select: { name: true } },
        orderItems: {
          where: {
            order: {
              createdAt: { gte: start, lte: end },
              status: { in: SALE_STATUSES }
            }
          },
          select: {
            quantity: true,
            price: true,
            order: {
              select: { id: true }
            }
          }
        }
      }
    });

    const detailedProducts = await Promise.all(
      products.map(async (product) => {
        // Calculs des ventes
        const totalQuantitySold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalRevenue = product.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalRevenueWithTax = totalRevenue * 1.20;
        const uniqueOrders = new Set(product.orderItems.map(item => item.order.id)).size;

        // Prix d'achat le plus récent
        const recentPurchase = await prisma.purchaseOrderItem.findFirst({
          where: { productId: product.id },
          orderBy: { createdAt: 'desc' },
          select: { unitPrice: true }
        });
        const purchasePrice = recentPurchase?.unitPrice || 0;

        // Calculs de rentabilité
        const unitGrossMargin = product.price - purchasePrice;
        const totalGrossMargin = unitGrossMargin * totalQuantitySold;
        const marginPercentage = product.price > 0 ? ((unitGrossMargin / product.price) * 100) : 0;

        // Informations stock et réassort
        const stockStatus = product.stock <= 0 ? 'Rupture' : 
                           product.stock <= (product.stockAlert || 10) ? 'Alerte' : 'Normal';

        // Dernier réassort
        const lastRestock = await prisma.purchaseOrderItem.findFirst({
          where: { 
            productId: product.id,
            purchaseOrder: { status: { in: ['RECEIVED', 'REÇU_TOTAL', 'REÇU_PARTIEL'] } }
          },
          include: {
            purchaseOrder: { select: { receivedDate: true } }
          },
          orderBy: { updatedAt: 'desc' }
        });

        return {
          // Identification produit
          productId: product.id,
          barcode: product.barcode || product.sku,
          name: product.name,
          brand: product.brand,
          category: product.category?.name,
          image: product.image,

          // Ventes
          quantitySold: totalQuantitySold,
          revenueHT: parseFloat(totalRevenue.toFixed(2)),
          revenueTTC: parseFloat(totalRevenueWithTax.toFixed(2)),
          ordersCount: uniqueOrders,

          // Rentabilité
          purchasePriceHT: parseFloat(purchasePrice.toFixed(2)),
          sellingPriceHT: parseFloat(product.price.toFixed(2)),
          unitGrossMargin: parseFloat(unitGrossMargin.toFixed(2)),
          totalGrossMargin: parseFloat(totalGrossMargin.toFixed(2)),
          marginPercentage: parseFloat(marginPercentage.toFixed(2)),

          // Stock et réassort
          currentStock: product.stock,
          alertThreshold: product.stockAlert || 10,
          stockStatus,
          lastRestock: lastRestock?.purchaseOrder?.receivedDate || null,

          // Métriques additionnelles
          averageOrderValue: uniqueOrders > 0 ? parseFloat((totalRevenue / uniqueOrders).toFixed(2)) : 0,
          averageQuantityPerOrder: uniqueOrders > 0 ? parseFloat((totalQuantitySold / uniqueOrders).toFixed(2)) : 0
        };
      })
    );

    // Trier par chiffre d'affaires décroissant
    const sortedProducts = detailedProducts
      .filter(p => p.quantitySold > 0 || productId) // Inclure tous si produit spécifique
      .sort((a, b) => b.revenueHT - a.revenueHT);

    res.json({
      period: { startDate: start, endDate: end },
      products: sortedProducts,
      summary: {
        totalProducts: sortedProducts.length,
        totalRevenue: sortedProducts.reduce((sum, p) => sum + p.revenueHT, 0),
        totalQuantitySold: sortedProducts.reduce((sum, p) => sum + p.quantitySold, 0),
        totalGrossMargin: sortedProducts.reduce((sum, p) => sum + p.totalGrossMargin, 0)
      }
    });
  } catch (error) {
    console.error('Detailed products report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/reports/top-products', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date('2030-12-31');
    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { in: SALE_STATUSES }
        }
      },
      include: {
        product: { select: { name: true, sku: true, image: true, brand: true } }
      }
    });

    const productStats = {};
    orderItems.forEach(item => {
      if (!item.product) return;
      const pid = item.productId;
      if (!productStats[pid]) {
        productStats[pid] = {
          productId: pid,
          name: item.product.name,
          sku: item.product.sku,
          image: item.product.image,
          brand: item.product.brand,
          quantity: 0,
          revenue: 0
        };
      }
      productStats[pid].quantity += item.quantity;
      productStats[pid].revenue += item.price * item.quantity;
    });

    const result = Object.values(productStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('Top products report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.get('/reports/bottom-products', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const start = startDate ? new Date(startDate) : new Date('2020-01-01');
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date('2030-12-31');
    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { in: SALE_STATUSES }
        }
      },
      include: {
        product: { select: { name: true, sku: true, image: true, brand: true } }
      }
    });

    const productStats = {};
    orderItems.forEach(item => {
      if (!item.product) return;
      const pid = item.productId;
      if (!productStats[pid]) {
        productStats[pid] = {
          productId: pid,
          name: item.product.name,
          sku: item.product.sku,
          image: item.product.image,
          brand: item.product.brand,
          quantity: 0,
          revenue: 0
        };
      }
      productStats[pid].quantity += item.quantity;
      productStats[pid].revenue += item.price * item.quantity;
    });

    const result = Object.values(productStats)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, parseInt(limit));
    res.json(result);
  } catch (error) {
    console.error('Bottom products report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== PRODUCTS ====================
router.get('/products', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, categoryId, brand, active, outOfStock, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    if (active !== undefined) where.active = active === 'true';
    if (outOfStock === 'true') where.stock = { lte: 0 };

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          subcategory: { select: { title: true } },
          subcategoryItem: { select: { name: true } },
          productVariants: {
            include: {
              variantType: { select: { name: true } }
            }
          }
        },
        orderBy,
        skip,
        take: parseInt(limit)
      }),
      prisma.product.count({ where })
    ]);

    // Add supplier info for admin stock management
    const productIds = products.map(p => p.id);
    
    const supplierInfo = await Promise.all(
      productIds.map(async (productId) => {
        // Get main supplier (most recent purchase order)
        const recentPurchase = await prisma.purchaseOrderItem.findFirst({
          where: { productId },
          include: {
            purchaseOrder: {
              include: {
                supplier: { select: { name: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        // Get last restock date (most recent received purchase order)
        const lastRestock = await prisma.purchaseOrderItem.findFirst({
          where: { 
            productId,
            purchaseOrder: { status: { in: ['RECEIVED', 'REÇU_TOTAL', 'REÇU_PARTIEL'] } }
          },
          include: {
            purchaseOrder: { select: { receivedDate: true } }
          },
          orderBy: { updatedAt: 'desc' }
        });
        
        // Get last sale date
        const lastSale = await prisma.stockMovement.findFirst({
          where: { 
            productId,
            type: 'SALE'
          },
          orderBy: { createdAt: 'desc' }
        });
        
        return {
          productId,
          mainSupplier: recentPurchase?.purchaseOrder?.supplier?.name || null,
          lastRestock: lastRestock?.purchaseOrder?.receivedDate || null,
          lastSale: lastSale?.createdAt || null
        };
      })
    );
    
    // Merge supplier info with products
    const productsWithSupplierInfo = products.map(product => {
      const info = supplierInfo.find(s => s.productId === product.id);
      return {
        ...product,
        mainSupplier: info?.mainSupplier,
        lastRestock: info?.lastRestock,
        lastSale: info?.lastSale
      };
    });

    res.json({
      products: productsWithSupplierInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== REVIEWS ====================
router.get('/reviews', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { approved, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = approved !== undefined ? { approved: approved === 'true' } : {};

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          product: { select: { name: true, image: true } },
          client: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.review.count({ where })
    ]);

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.put('/reviews/:id/approve', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    const review = await prisma.review.update({
      where: { id },
      data: { approved: true }
    });
    res.json(review);
  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

router.delete('/reviews/:id', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.review.delete({ where: { id } });
    res.json({ message: 'Avis supprimé' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== PERMISSIONS EMPLOYÉS ====================
router.use('/employees/permissions', employeePermissionsRouter);

// ==================== STOCK NÉGATIF ====================
router.get('/stock/negative', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, name: true, stock: true, image: true, price: true, brand: true, sku: true },
      orderBy: { stock: 'asc' }
    });
    res.json(products);
  } catch (error) {
    console.error('Negative stock error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/stock/negative/generate-orders', verifyAdmin, autoCheckEmployeePermission, async (req, res) => {
  try {
    const negativeProducts = await prisma.product.findMany({
      where: { stock: { lt: 0 } },
      include: { suppliers: { include: { supplier: true }, take: 1 } }
    });

    if (negativeProducts.length === 0) {
      return res.json({ message: 'Aucun produit en stock négatif', orders: [] });
    }

    // Grouper par fournisseur (ou "sans fournisseur")
    const bySupplier = {};
    for (const product of negativeProducts) {
      const supplier = product.suppliers[0]?.supplier;
      const key = supplier?.id || '__no_supplier__';
      if (!bySupplier[key]) bySupplier[key] = { supplier, items: [] };
      bySupplier[key].items.push(product);
    }

    const createdOrders = [];

    for (const [supplierId, { supplier, items }] of Object.entries(bySupplier)) {
      if (!supplier) continue; // Ignorer les produits sans fournisseur

      const orderNumber = `BC-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const orderItems = items.map(p => ({
        productId: p.id,
        quantity: Math.abs(p.stock), // Quantité = valeur absolue du stock négatif
        unitPrice: p.suppliers[0]?.price || 0,
        notes: `Stock négatif: ${p.stock}`
      }));

      const totalAmount = orderItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          orderNumber,
          supplierId: supplier.id,
          status: 'BROUILLON',
          totalAmount,
          notes: `Généré automatiquement pour stock négatif le ${new Date().toLocaleDateString('fr-FR')}`,
          items: { create: orderItems }
        },
        include: { supplier: true, items: { include: { product: { select: { name: true } } } } }
      });

      createdOrders.push(purchaseOrder);
    }

    // Notification
    const io = getIo();
    if (io && createdOrders.length > 0) {
      io.to('admin_room').emit('notification', {
        type: 'PURCHASE_ORDERS_GENERATED',
        title: '📋 Bons de commande générés',
        message: `${createdOrders.length} bon(s) de commande créé(s) pour stock négatif`,
        data: { count: createdOrders.length }
      });
    }

    res.json({
      message: `${createdOrders.length} bon(s) de commande généré(s)`,
      orders: createdOrders,
      skipped: negativeProducts.filter(p => !p.suppliers[0]).map(p => ({ id: p.id, name: p.name, stock: p.stock }))
    });
  } catch (error) {
    console.error('Generate purchase orders error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;
