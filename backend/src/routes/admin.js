import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware pour vérifier si l'utilisateur est admin
// backend/src/routes/admin.js
// MODIFIER le middleware verifyAdmin pour accepter CAISSIER et PREPARATEUR

const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true }
    });

    // ← MODIFICATION ICI : accepter ADMIN, CAISSIER et PREPARATEUR
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CAISSIER' && user.role !== 'PREPARATEUR')) {
      return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ message: 'Compte désactivé' });
    }

    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};
// Login admin
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier si c'est un email admin autorisé
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['admin@parapharmacie.ma'];
    
    if (!adminEmails.includes(email)) {
      return res.status(403).json({ message: 'Accès administrateur non autorisé' });
    }

    // Utiliser la route de login normale mais vérifier le rôle
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Accès administrateur non autorisé' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Connexion admin réussie',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// KPIs - Statistiques temps réel
router.get('/kpis', verifyAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Commandes du jour
    const ordersToday = await prisma.order.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // CA journalier
    const dailyRevenue = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        },
        status: { not: 'CANCELLED' }
      },
      _sum: { total: true }
    });

    // CA mensuel
    const monthlyRevenue = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth
        },
        status: { not: 'CANCELLED' }
      },
      _sum: { total: true }
    });

    // Produits en rupture de stock
    const outOfStock = await prisma.product.count({
      where: { stock: { lte: 0 } }
    });

    // Produits en stock faible (< 10)
    const lowStock = await prisma.product.count({
      where: { 
        stock: { 
          gt: 0,
          lte: 10 
        } 
      }
    });

    // Créneaux réservés aujourd'hui
    const slotsReservedToday = await prisma.order.count({
      where: {
        timeSlotDate: {
          gte: today,
          lt: tomorrow
        },
        status: { notIn: ['CANCELLED', 'COMPLETED'] }
      }
    });

    // Commandes non traitées
    const pendingOrders = await prisma.order.count({
      where: {
        status: 'RECEIVED'
      }
    });

    res.json({
      ordersToday,
      dailyRevenue: dailyRevenue._sum.total || 0,
      monthlyRevenue: monthlyRevenue._sum.total || 0,
      outOfStock,
      lowStock,
      slotsReservedToday,
      pendingOrders
    });
  } catch (error) {
    console.error('KPIs error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Graphique des ventes (7j/30j/12m)
router.get('/sales-chart', verifyAdmin, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const now = new Date();
    let startDate = new Date();
    let groupBy = 'day';

    if (period === '7d') {
      startDate.setDate(now.getDate() - 7);
      groupBy = 'day';
    } else if (period === '30d') {
      startDate.setDate(now.getDate() - 30);
      groupBy = 'day';
    } else if (period === '12m') {
      startDate.setMonth(now.getMonth() - 12);
      groupBy = 'month';
    }

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { not: 'CANCELLED' }
      },
      select: {
        createdAt: true,
        total: true
      }
    });

    // Grouper les données
    const salesData = {};
    orders.forEach(order => {
      let key;
      if (groupBy === 'day') {
        key = order.createdAt.toISOString().split('T')[0];
      } else {
        key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!salesData[key]) {
        salesData[key] = { date: key, revenue: 0, orders: 0 };
      }
      salesData[key].revenue += order.total;
      salesData[key].orders += 1;
    });

    const chartData = Object.values(salesData).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    res.json(chartData);
  } catch (error) {
    console.error('Sales chart error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Commandes urgentes (dans les 2 heures)
router.get('/urgent-orders', verifyAdmin, async (req, res) => {
  try {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const urgentOrders = await prisma.order.findMany({
      where: {
        timeSlotDate: {
          gte: now,
          lte: twoHoursLater
        },
        status: { in: ['RECEIVED', 'PREPARING'] }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                image: true
              }
            }
          }
        }
      },
      orderBy: {
        timeSlotDate: 'asc'
      }
    });

    res.json(urgentOrders);
  } catch (error) {
    console.error('Urgent orders error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Produits en stock faible
router.get('/low-stock-products', verifyAdmin, async (req, res) => {
  try {
    const { threshold = 10 } = req.query;

    const products = await prisma.product.findMany({
      where: {
        stock: {
          lte: parseInt(threshold)
        }
      },
      select: {
        id: true,
        name: true,
        stock: true,
        image: true,
        price: true,
        brand: true
      },
      orderBy: {
        stock: 'asc'
      }
    });

    res.json(products);
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Carte thermique des créneaux
router.get('/heatmap-slots', verifyAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const orders = await prisma.order.findMany({
      where: {
        timeSlotDate: { gte: startDate },
        timeSlotStart: { not: null }
      },
      select: {
        timeSlotStart: true,
        timeSlotDate: true
      }
    });

    // Créer une carte thermique par jour de la semaine et heure
    const heatmap = {};
    const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    orders.forEach(order => {
      const dayOfWeek = new Date(order.timeSlotDate).getDay();
      const hour = order.timeSlotStart;

      const key = `${daysOfWeek[dayOfWeek]}-${hour}`;
      heatmap[key] = (heatmap[key] || 0) + 1;
    });

    // Transformer en format pour le graphique
    const heatmapData = [];
    for (let day = 1; day < 7; day++) { // Exclure dimanche (0)
      for (let hour = 9; hour < 19; hour++) {
        for (let minute of [0, 30]) {
          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          const key = `${daysOfWeek[day]}-${timeStr}`;
          heatmapData.push({
            day: daysOfWeek[day],
            time: timeStr,
            count: heatmap[key] || 0
          });
        }
      }
    }

    res.json(heatmapData);
  } catch (error) {
    console.error('Heatmap error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Liste de toutes les commandes avec filtres
router.get('/orders', verifyAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
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
                  name: true,
                  image: true,
                  price: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Mettre à jour le statut d'une commande
router.put('/orders/:orderId/status', verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        user: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.json({ message: 'Statut mis à jour', order });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ==================== GESTION DES CODES PROMO ====================

// GET /admin/promo-codes - Récupérer tous les codes promo
router.get('/promo-codes', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = active !== undefined ? { active: active === 'true' } : {};

    const [promoCodes, total] = await Promise.all([
      prisma.promoCode.findMany({
        where,
        include: {
          promoHistory: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.promoCode.count({ where })
    ]);

    const withStats = promoCodes.map(promo => ({
      ...promo,
      usageCount: promo.promoHistory.length,
      promoHistory: undefined
    }));

    res.json({
      promoCodes: withStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Promo codes list error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /admin/promo-codes - Créer un code promo
router.post('/promo-codes', verifyAdmin, async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      applicableOn,
      productIds,
      categoryIds,
      minPurchaseAmount,
      maxDiscountAmount,
      usageLimit,
      expiryDate,
      active
    } = req.body;

    // Validation
    if (!code || !discountValue) {
      return res.status(400).json({ message: 'Code et valeur de réduction requis' });
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        description,
        discountType: discountType || 'percentage',
        discountValue: parseFloat(discountValue),
        applicableOn: applicableOn || 'global',
        productIds: productIds ? Array.isArray(productIds) ? productIds : JSON.parse(productIds) : [],
        categoryIds: categoryIds ? Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds) : [],
        minPurchaseAmount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : 0,
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        active: active !== false
      }
    });

    res.status(201).json({ message: 'Code promo créé', promoCode });
  } catch (error) {
    console.error('Create promo code error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ce code promo existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/promo-codes/:id - Récupérer un code promo
router.get('/promo-codes/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const promoCode = await prisma.promoCode.findUnique({
      where: { id },
      include: {
        promoHistory: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
                createdAt: true,
                user: {
                  select: { id: true, email: true, firstName: true, lastName: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 100
        }
      }
    });

    if (!promoCode) {
      return res.status(404).json({ message: 'Code promo non trouvé' });
    }

    res.json(promoCode);
  } catch (error) {
    console.error('Get promo code error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/promo-codes/:id - Modifier un code promo
router.put('/promo-codes/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      discountType,
      discountValue,
      applicableOn,
      productIds,
      categoryIds,
      minPurchaseAmount,
      maxDiscountAmount,
      usageLimit,
      expiryDate,
      active
    } = req.body;

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(description !== undefined && { description }),
        ...(discountType && { discountType }),
        ...(discountValue !== undefined && { discountValue: parseFloat(discountValue) }),
        ...(applicableOn && { applicableOn }),
        ...(productIds && { productIds: Array.isArray(productIds) ? productIds : JSON.parse(productIds) }),
        ...(categoryIds && { categoryIds: Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds) }),
        ...(minPurchaseAmount !== undefined && { minPurchaseAmount: parseFloat(minPurchaseAmount) }),
        ...(maxDiscountAmount !== undefined && { maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null }),
        ...(usageLimit !== undefined && { usageLimit: usageLimit ? parseInt(usageLimit) : null }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(active !== undefined && { active })
      }
    });

    res.json({ message: 'Code promo mis à jour', promoCode });
  } catch (error) {
    console.error('Update promo code error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/promo-codes/:id - Supprimer un code promo
router.delete('/promo-codes/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.promoCode.delete({
      where: { id }
    });

    res.json({ message: 'Code promo supprimé' });
  } catch (error) {
    console.error('Delete promo code error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ==================== GESTION DES PROMOTIONS ====================

// GET /admin/promotions - Récupérer toutes les promotions
router.get('/promotions', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = active !== undefined ? { active: active === 'true' } : {};

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

    res.json({
      promotions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Promotions list error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /admin/promotions - Créer une promotion
router.post('/promotions', verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      bannerImage,
      bannerText,
      discountType,
      discountValue,
      applicableOn,
      productIds,
      categoryIds,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      displayOnHomepage,
      order,
      active
    } = req.body;

    // Validation
    if (!title || !discountValue || !startDate || !endDate) {
      return res.status(400).json({ message: 'Titre, valeur de réduction, données de début et fin requis' });
    }

    const promotion = await prisma.promotion.create({
      data: {
        title,
        description,
        bannerImage,
        bannerText,
        discountType: discountType || 'percentage',
        discountValue: parseFloat(discountValue),
        applicableOn: applicableOn || 'global',
        productIds: productIds ? Array.isArray(productIds) ? productIds : JSON.parse(productIds) : [],
        categoryIds: categoryIds ? Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds) : [],
        minPurchaseAmount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : 0,
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        displayOnHomepage: displayOnHomepage !== false,
        order: order ? parseInt(order) : 0,
        active: active !== false
      }
    });

    // Créer les statistiques vides
    await prisma.promotionStats.create({
      data: { promotionId: promotion.id }
    });

    const result = await prisma.promotion.findUnique({
      where: { id: promotion.id },
      include: { stats: true }
    });

    res.status(201).json({ message: 'Promotion créée', promotion: result });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/promotions/:id - Récupérer une promotion
router.get('/promotions/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: { stats: true }
    });

    if (!promotion) {
      return res.status(404).json({ message: 'Promotion non trouvée' });
    }

    res.json(promotion);
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/promotions/:id - Modifier une promotion
router.put('/promotions/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      bannerImage,
      bannerText,
      discountType,
      discountValue,
      applicableOn,
      productIds,
      categoryIds,
      minPurchaseAmount,
      maxDiscountAmount,
      startDate,
      endDate,
      displayOnHomepage,
      order,
      active
    } = req.body;

    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(bannerImage !== undefined && { bannerImage }),
        ...(bannerText !== undefined && { bannerText }),
        ...(discountType && { discountType }),
        ...(discountValue !== undefined && { discountValue: parseFloat(discountValue) }),
        ...(applicableOn && { applicableOn }),
        ...(productIds && { productIds: Array.isArray(productIds) ? productIds : JSON.parse(productIds) }),
        ...(categoryIds && { categoryIds: Array.isArray(categoryIds) ? categoryIds : JSON.parse(categoryIds) }),
        ...(minPurchaseAmount !== undefined && { minPurchaseAmount: parseFloat(minPurchaseAmount) }),
        ...(maxDiscountAmount !== undefined && { maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(displayOnHomepage !== undefined && { displayOnHomepage }),
        ...(order !== undefined && { order: parseInt(order) }),
        ...(active !== undefined && { active })
      },
      include: { stats: true }
    });

    res.json({ message: 'Promotion mise à jour', promotion });
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/promotions/:id - Supprimer une promotion
router.delete('/promotions/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Supprimer les statistiques d'abord
    await prisma.promotionStats.deleteMany({
      where: { promotionId: id }
    });

    await prisma.promotion.delete({
      where: { id }
    });

    res.json({ message: 'Promotion supprimée' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/promotions-stats - Récupérer les statistiques d'une promotion
router.get('/promotions/:id/stats', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await prisma.promotionStats.findUnique({
      where: { promotionId: id }
    });

    if (!stats) {
      return res.status(404).json({ message: 'Statistiques non trouvées' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Get promotion stats error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/promotions/:id/stats - Mettre à jour les statistiques
router.put('/promotions/:id/stats', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { impressions, clicks, conversions, totalDiscount, ordersCount } = req.body;

    const stats = await prisma.promotionStats.update({
      where: { promotionId: id },
      data: {
        ...(impressions !== undefined && { impressions: parseInt(impressions) }),
        ...(clicks !== undefined && { clicks: parseInt(clicks) }),
        ...(conversions !== undefined && { conversions: parseInt(conversions) }),
        ...(totalDiscount !== undefined && { totalDiscount: parseFloat(totalDiscount) }),
        ...(ordersCount !== undefined && { ordersCount: parseInt(ordersCount) })
      }
    });

    res.json({ message: 'Statistiques mises à jour', stats });
  } catch (error) {
    console.error('Update promotion stats error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DES CRÉNEAUX CLICK & COLLECT =====

// GET /admin/time-slots/config - Récupérer la configuration des créneaux
router.get('/time-slots/config', verifyAdmin, async (req, res) => {
  try {
    const configs = await prisma.timeSlotConfig.findMany({
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

// POST /admin/time-slots/config - Créer une configuration de créneau
router.post('/time-slots/config', verifyAdmin, async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, capacity, intervalMinutes, active } = req.body;

    // Validation
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ message: 'Jour, heure de début et heure de fin requis' });
    }

    const config = await prisma.timeSlotConfig.create({
      data: {
        dayOfWeek: parseInt(dayOfWeek),
        startTime,
        endTime,
        capacity: capacity || 1,
        intervalMinutes: intervalMinutes || 30,
        active: active !== undefined ? active : true
      }
    });

    res.status(201).json(config);
  } catch (error) {
    console.error('Create time slot config error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Cette configuration existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/time-slots/config/:id - Modifier une configuration de créneau
router.put('/time-slots/config/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, capacity, intervalMinutes, active } = req.body;

    const config = await prisma.timeSlotConfig.update({
      where: { id },
      data: {
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(capacity !== undefined && { capacity }),
        ...(intervalMinutes !== undefined && { intervalMinutes }),
        ...(active !== undefined && { active })
      }
    });

    res.json(config);
  } catch (error) {
    console.error('Update time slot config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/time-slots/config/:id - Supprimer une configuration de créneau
router.delete('/time-slots/config/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.timeSlotConfig.delete({
      where: { id }
    });
    res.json({ message: 'Configuration supprimée' });
  } catch (error) {
    console.error('Delete time slot config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/time-slots/blocked - Récupérer les créneaux bloqués
router.get('/time-slots/blocked', verifyAdmin, async (req, res) => {
  try {
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: { active: true },
      orderBy: { date: 'asc' }
    });
    res.json(blockedSlots);
  } catch (error) {
    console.error('Get blocked slots error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /admin/time-slots/blocked - Bloquer un créneau
router.post('/time-slots/blocked', verifyAdmin, async (req, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body;

    // Validation
    if (!date || !reason) {
      return res.status(400).json({ message: 'Date et raison requis' });
    }

    const blockedSlot = await prisma.blockedSlot.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
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

// DELETE /admin/time-slots/blocked/:id - Débloquer un créneau
router.delete('/time-slots/blocked/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.blockedSlot.update({
      where: { id },
      data: { active: false }
    });
    res.json({ message: 'Créneau débloqué' });
  } catch (error) {
    console.error('Delete blocked slot error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/time-slots/available - Récupérer les créneaux disponibles pour une date
router.get('/time-slots/available', verifyAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date requise' });
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Récupérer la configuration du jour
    const configs = await prisma.timeSlotConfig.findMany({
      where: {
        dayOfWeek,
        active: true
      },
      orderBy: { startTime: 'asc' }
    });

    // Récupérer les créneaux bloqués pour cette date
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: {
        date: targetDate,
        active: true
      }
    });

    // Récupérer les commandes existantes pour cette date
    const existingOrders = await prisma.order.findMany({
      where: {
        timeSlotDate: targetDate,
        timeSlotStart: { not: null }
      },
      select: {
        timeSlotStart: true,
        timeSlotEnd: true
      }
    });

    // Générer les créneaux disponibles
    const availableSlots = [];

    for (const config of configs) {
      const startTime = new Date(`${date}T${config.startTime}`);
      const endTime = new Date(`${date}T${config.endTime}`);
      const intervalMs = config.intervalMinutes * 60 * 1000;

      for (let time = startTime; time < endTime; time = new Date(time.getTime() + intervalMs)) {
        const slotEnd = new Date(time.getTime() + intervalMs);
        const timeStr = time.toTimeString().slice(0, 5);
        const endStr = slotEnd.toTimeString().slice(0, 5);

        // Vérifier si le créneau est bloqué
        const isBlocked = blockedSlots.some(blocked => {
          if (!blocked.startTime) return true; // Journée entière bloquée
          const blockedStart = new Date(`${date}T${blocked.startTime}`);
          const blockedEnd = blocked.endTime ? new Date(`${date}T${blocked.endTime}`) : new Date(`${date}T23:59`);
          return time >= blockedStart && time < blockedEnd;
        });

        if (isBlocked) continue;

        // Compter les réservations existantes pour ce créneau
        const reservationsCount = existingOrders.filter(order => {
          return order.timeSlotStart === timeStr;
        }).length;

        availableSlots.push({
          time: timeStr,
          endTime: endStr,
          capacity: config.capacity,
          reservations: reservationsCount,
          available: reservationsCount < config.capacity
        });
      }
    }

    res.json(availableSlots);
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/time-slots/calendar - Vue calendrier des réservations
router.get('/time-slots/calendar', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut

    // Récupérer toutes les commandes avec créneaux dans la période
    const orders = await prisma.order.findMany({
      where: {
        timeSlotDate: {
          gte: start,
          lte: end
        },
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
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true }
        }
      },
      orderBy: [
        { timeSlotDate: 'asc' },
        { timeSlotStart: 'asc' }
      ]
    });

    // Grouper par date
    const calendarData = {};
    orders.forEach(order => {
      const dateKey = order.timeSlotDate.toISOString().split('T')[0];
      if (!calendarData[dateKey]) {
        calendarData[dateKey] = [];
      }
      calendarData[dateKey].push(order);
    });

    res.json(calendarData);
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/time-slots/today-reservations - Réservations du jour (pour export PDF)
router.get('/time-slots/today-reservations', verifyAdmin, async (req, res) => {
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
        user: {
          select: { firstName: true, lastName: true, email: true, phone: true }
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

// ===== RAPPORTS ET STATISTIQUES =====

// GET /admin/reports/sales - Rapport de ventes global
router.get('/reports/sales', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate, period = 'monthly' } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 jours par défaut
    const end = endDate ? new Date(endDate) : new Date();

    // Récupérer toutes les commandes dans la période
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: { in: ['RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED'] }
      },
      select: {
        id: true,
        total: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                category: {
                  select: { name: true }
                }
              }
            }
          }
        }
      }
    });

    // Agréger par date/période
    const salesByPeriod = {};
    let totalRevenue = 0;
    let totalOrders = 0;
    let totalItems = 0;

    orders.forEach(order => {
      totalRevenue += order.total;
      totalOrders += 1;
      order.items.forEach(item => {
        totalItems += item.quantity;
      });

      // Clé de période
      const date = new Date(order.createdAt);
      let periodKey;
      if (period === 'daily') {
        periodKey = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = `Week ${weekStart.toISOString().split('T')[0]}`;
      } else {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!salesByPeriod[periodKey]) {
        salesByPeriod[periodKey] = {
          date: periodKey,
          revenue: 0,
          orders: 0,
          items: 0
        };
      }
      salesByPeriod[periodKey].revenue += order.total;
      salesByPeriod[periodKey].orders += 1;
      salesByPeriod[periodKey].items += order.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    res.json({
      period: { startDate: start, endDate: end, type: period },
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        totalItems,
        averageOrderValue: parseFloat((totalRevenue / (totalOrders || 1)).toFixed(2))
      },
      data: Object.values(salesByPeriod).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/products - Rapport par produit
router.get('/reports/products', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED'] }
      },
      select: {
        total: true,
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
                brand: true,
                stockAlert: true
              }
            }
          }
        }
      }
    });

    // Agréger par produit
    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product.id;
        if (!productStats[productId]) {
          productStats[productId] = {
            productId,
            productName: item.product.name,
            brand: item.product.brand,
            quantity: 0,
            revenue: 0,
            unitPrice: item.price
          };
        }
        productStats[productId].quantity += item.quantity;
        productStats[productId].revenue += item.price * item.quantity;
      });
    });

    const data = Object.values(productStats)
      .map(stat => ({
        ...stat,
        revenue: parseFloat(stat.revenue.toFixed(2)),
        avgUnitPrice: parseFloat(stat.unitPrice.toFixed(2))
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      period: { startDate: start, endDate: end },
      data
    });
  } catch (error) {
    console.error('Products report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/categories - Rapport par catégorie
router.get('/reports/categories', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED'] }
      },
      select: {
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                categoryId: true,
                category: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      }
    });

    // Agréger par catégorie
    const categoryStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const categoryId = item.product.categoryId;
        if (!categoryStats[categoryId]) {
          categoryStats[categoryId] = {
            categoryId,
            categoryName: item.product.category.name,
            quantity: 0,
            revenue: 0,
            orders: 0
          };
        }
        categoryStats[categoryId].quantity += item.quantity;
        categoryStats[categoryId].revenue += item.price * item.quantity;
      });
    });

    const data = Object.values(categoryStats)
      .map(stat => ({
        ...stat,
        revenue: parseFloat(stat.revenue.toFixed(2))
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      period: { startDate: start, endDate: end },
      data
    });
  } catch (error) {
    console.error('Categories report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/top-products - Top produits les plus vendus
router.get('/reports/top-products', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED'] }
      },
      select: {
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                brand: true
              }
            }
          }
        }
      }
    });

    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product.id;
        if (!productStats[productId]) {
          productStats[productId] = {
            productId,
            productName: item.product.name,
            image: item.product.image,
            brand: item.product.brand,
            quantity: 0,
            revenue: 0
          };
        }
        productStats[productId].quantity += item.quantity;
        productStats[productId].revenue += item.price * item.quantity;
      });
    });

    const data = Object.values(productStats)
      .map(stat => ({
        ...stat,
        revenue: parseFloat(stat.revenue.toFixed(2))
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, parseInt(limit));

    res.json({
      period: { startDate: start, endDate: end },
      data
    });
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/bottom-products - Produits les moins vendus
router.get('/reports/bottom-products', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Récupérer tous les produits
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        brand: true,
        _count: {
          select: { orderItems: true }
        }
      }
    });

    // Récupérer les produits vendus
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: ['RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED'] }
      },
      select: {
        items: {
          select: {
            quantity: true,
            product: { select: { id: true } }
          }
        }
      }
    });

    const soldProducts = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!soldProducts[item.product.id]) {
          soldProducts[item.product.id] = 0;
        }
        soldProducts[item.product.id] += item.quantity;
      });
    });

    // Créer une liste avec tous les produits
    const data = allProducts
      .map(product => ({
        productId: product.id,
        productName: product.name,
        image: product.image,
        brand: product.brand,
        quantity: soldProducts[product.id] || 0,
        totalOrders: product._count.orderItems
      }))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, parseInt(limit));

    res.json({
      period: { startDate: start, endDate: end },
      data
    });
  } catch (error) {
    console.error('Bottom products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/click-collect - Rapport Click & Collect
router.get('/reports/click-collect', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

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
router.get('/reports/export/:type', verifyAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json', startDate, endDate } = req.query;

    let reportData;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Récupérer les données selon le type
    if (type === 'sales') {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: ['RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED'] }
        },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          createdAt: true,
          items: { select: { quantity: true, price: true } }
        }
      });

      reportData = orders.map(order => ({
        'Numéro Commande': order.orderNumber,
        'Montant': order.total,
        'Articles': order.items.length,
        'Quantité': order.items.reduce((sum, item) => sum + item.quantity, 0),
        'Date': new Date(order.createdAt).toLocaleDateString('fr-FR')
      }));
    } else if (type === 'products') {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: ['RECEIVED', 'PREPARING', 'READY', 'PICKED_UP', 'DELIVERED'] }
        },
        select: {
          items: {
            select: {
              quantity: true,
              price: true,
              product: { select: { name: true, brand: true } }
            }
          }
        }
      });

      const productStats = {};
      orders.forEach(order => {
        order.items.forEach(item => {
          const key = item.product.name;
          if (!productStats[key]) {
            productStats[key] = {
              produit: item.product.name,
              marque: item.product.brand,
              quantité: 0,
              revenu: 0
            };
          }
          productStats[key].quantité += item.quantity;
          productStats[key].revenu += item.price * item.quantity;
        });
      });

      reportData = Object.values(productStats);
    }

    if (format === 'csv') {
      const { parse } = await import('json2csv');
      const csv = parse(reportData);
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename="rapport_${type}_${Date.now()}.csv"`);
      res.send('\ufeff' + csv); // BOM pour UTF-8
    } else {
      res.header('Content-Type', 'application/json; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename="rapport_${type}_${Date.now()}.json"`);
      res.send(JSON.stringify(reportData, null, 2));
    }
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DES UTILISATEURS =====

// GET /admin/users - Liste des utilisateurs avec filtres et pagination
router.get('/users', verifyAdmin, async (req, res) => {
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
      where.role = role;
    }
    if (status && status !== 'ALL') {
      where.isActive = status === 'ACTIVE';
    }

    // Récupérer les utilisateurs
    const [users, total] = await Promise.all([
      prisma.user.findMany({
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
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
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
router.get('/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
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
router.put('/users/:id', verifyAdmin, async (req, res) => {
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
    const oldUser = await prisma.user.findUnique({
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
    const updatedUser = await prisma.user.update({
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
router.put('/users/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Le statut doit être un booléen' });
    }

    // Récupérer l'utilisateur avant modification
    const oldUser = await prisma.user.findUnique({
      where: { id },
      select: { isActive: true, email: true }
    });

    if (!oldUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Mettre à jour le statut
    const updatedUser = await prisma.user.update({
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
router.delete('/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que ce n'est pas le dernier admin
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } }
      });
      if (adminCount === 0) {
        return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur' });
      }
    }

    // Désactiver l'utilisateur au lieu de le supprimer
    await prisma.user.update({
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

// GET /admin/audit-logs - Journal d'activité (audit log)
router.get('/audit-logs', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, action, entityType, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Construire les filtres
    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // Récupérer les logs d'audit
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/audit-logs/stats - Statistiques du journal d'audit
router.get('/audit-logs/stats', verifyAdmin, async (req, res) => {
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
        user: {
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

export default router;
