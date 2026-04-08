import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getIo } from '../io.js';

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
// Logique : combine timeSlotDate (date) + timeSlotStart ("HH:MM") pour obtenir
// le datetime exact du créneau, puis vérifie si différence avec maintenant <= 2h
router.get('/urgent-orders', verifyAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Chercher les commandes actives des 3 prochains jours qui ont un créneau
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const candidates = await prisma.order.findMany({
      where: {
        timeSlotDate: { gte: now, lte: threeDaysLater },
        timeSlotStart: { not: null },
        status: { in: ['RECEIVED', 'PREPARING'] }
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, phone: true, email: true }
        },
        items: {
          include: {
            product: { select: { name: true, image: true } }
          }
        }
      },
      orderBy: [{ timeSlotDate: 'asc' }, { timeSlotStart: 'asc' }]
    });

    // Filtrer en JS : construire le datetime exact du créneau et vérifier <= 2h
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    const urgentOrders = candidates
      .map(order => {
        // timeSlotDate est stocké en UTC midnight (ex: 2024-01-15T00:00:00.000Z)
        // timeSlotStart est "HH:MM" en heure locale Maroc (UTC+1)
        const dateStr = order.timeSlotDate.toISOString().slice(0, 10); // YYYY-MM-DD
        const [h, m] = order.timeSlotStart.split(':').map(Number);

        // Construire le datetime du créneau en UTC (Maroc = UTC+1, donc soustraire 1h)
        const slotDatetime = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`);
        // Convertir de l'heure Maroc (UTC+1) vers UTC : soustraire 1h
        const slotDatetimeUTC = new Date(slotDatetime.getTime() - 60 * 60 * 1000);

        const diffMs = slotDatetimeUTC.getTime() - now.getTime();
        return { ...order, _diffMs: diffMs, _slotDatetime: slotDatetimeUTC };
      })
      .filter(order => order._diffMs >= 0 && order._diffMs <= TWO_HOURS_MS) // entre maintenant et +2h
      .map(({ _diffMs, _slotDatetime, ...order }) => ({
        ...order,
        minutesUntilSlot: Math.floor(_diffMs / 60000) // minutes restantes
      }));

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

    // Récupérer la commande AVANT mise à jour pour connaître l'ancien statut
    const orderBefore = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: { include: { product: { select: { id: true, name: true, stock: true, stockAlert: true } } } }
      }
    });

    if (!orderBefore) {
      return res.status(404).json({ message: 'Commande non trouvée' });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { user: true, items: { include: { product: true } } }
    });

    const io = getIo();

    // ── Règle 1 : Déduction automatique RECEIVED → PREPARING ──
    if (status === 'PREPARING' && orderBefore.status === 'RECEIVED') {
      for (const item of orderBefore.items) {
        const newStock = Math.max(0, item.product.stock - item.quantity);
        await prisma.product.update({ where: { id: item.productId }, data: { stock: newStock } });
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantity: -item.quantity,
            reason: `Commande confirmée ${orderBefore.orderNumber}`,
            userId: req.userId
          }
        });
        if (io && newStock <= item.product.stockAlert) {
          io.to('admin_room').emit('admin_stock_alert', {
            productId: item.productId,
            productName: item.product.name,
            stock: newStock,
            stockAlert: item.product.stockAlert,
            timestamp: new Date()
          });
        }
      }
    }

    // ── Règle 2 : Restauration automatique sur annulation ou retour ──
    // Le stock est déduit uniquement quand la commande passe en PREPARING ou au-delà.
    // Statuts où le stock a déjà été déduit :
    const STOCK_DEDUCTED_STATUSES = ['PREPARING', 'READY', 'COMPLETED'];
    // Statuts finaux qui ne doivent pas déclencher une double restauration :
    const TERMINAL_STATUSES = ['CANCELLED', 'REFUNDED', 'RETURNED'];

    const stockWasPreviouslyDeducted = STOCK_DEDUCTED_STATUSES.includes(orderBefore.status);
    const isNowTerminal = TERMINAL_STATUSES.includes(status);
    const wasAlreadyTerminal = TERMINAL_STATUSES.includes(orderBefore.status);

    if (isNowTerminal && stockWasPreviouslyDeducted && !wasAlreadyTerminal) {
      for (const item of orderBefore.items) {
        const newStock = item.product.stock + item.quantity;
        await prisma.product.update({ where: { id: item.productId }, data: { stock: newStock } });
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'RETURN',
            quantity: item.quantity,
            reason: `${status === 'RETURNED' ? 'Retour produit' : 'Annulation'} commande ${orderBefore.orderNumber}`,
            userId: req.userId
          }
        });
      }
    }
    // Si annulation depuis RECEIVED : stock jamais déduit → rien à restaurer

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

    // Notifier tous les clients connectés du nouveau code promo via Socket.IO
    const io = getIo();
    if (io) {
      io.emit('notification', {
        type: 'PROMO_CODE',
        title: '🎉 Nouveau code promo !',
        message: `Utilisez le code ${promoCode.code} pour bénéficier de ${
          promoCode.discountType === 'percentage'
            ? `${promoCode.discountValue}% de réduction`
            : `${promoCode.discountValue} DH de réduction`
        }${promoCode.expiryDate ? ` jusqu'au ${new Date(promoCode.expiryDate).toLocaleDateString('fr-FR')}` : ''}`,
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        expiryDate: promoCode.expiryDate,
        timestamp: new Date()
      });
      console.log('📢 Notification promo code envoyée à tous les clients');
    }

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
// backend/src/routes/admin.js
// Cherchez la route POST /promotions et modifiez-la

router.post('/promotions', verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      subtitle,
      bannerImage,
      discountType,
      discountValue,
      oldPrice,
      price,
      stock,
      rating,
      productId,
      productName,
      productImage,
      badge,
      badgeColor,
      bgColor,
      iconName,
      features,
      ctaText,
      active,
      order,
      startDate,
      endDate
      // ← SUPPRIMEZ applicableOn ici
    } = req.body;

    // Validation
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ message: 'Titre et dates requis' });
    }

    const promotion = await prisma.promotion.create({
      data: {
        title,
        description,
        subtitle,
        bannerImage,
        discountType: discountType || 'percentage',
        discountValue: parseFloat(discountValue),
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        price: price ? parseFloat(price) : null,
        stock: stock ? parseInt(stock) : null,
        rating: rating ? parseFloat(rating) : null,
        productId,
        productName,
        productImage,
        badge,
        badgeColor,
        bgColor,
        iconName,
        features: features || [],
        ctaText: ctaText || 'Profiter maintenant',
        active: active !== false,
        order: order || 0,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    });

    // Créer les statistiques vides
    await prisma.promotionStats.create({
      data: { promotionId: promotion.id }
    });

    res.status(201).json({ message: 'Promotion créée', promotion });
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
    const { all } = req.query;
    // all=true returns ALL configs (including inactive) for admin UI
    const where = all === 'true' ? {} : { active: true };
    const configs = await prisma.timeSlotConfig.findMany({
      where,
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
        date: new Date(date + 'T00:00:00.000Z'),  // UTC midnight
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
    if (!date) return res.status(400).json({ message: 'Date requise' });

    const targetDateStart = new Date(date + 'T00:00:00.000Z');
    const targetDateEnd   = new Date(date + 'T23:59:59.999Z');
    const dayOfWeek = targetDateStart.getUTCDay();

    const configs = await prisma.timeSlotConfig.findMany({
      where: { dayOfWeek, active: true },
      orderBy: { startTime: 'asc' }
    });

    const blockedSlots = await prisma.blockedSlot.findMany({
      where: { active: true }
    });

    const existingOrders = await prisma.order.findMany({
      where: {
        timeSlotDate: { gte: targetDateStart, lte: targetDateEnd },
        timeSlotStart: { not: null }
      },
      select: { timeSlotStart: true }
    });
    const reservationsCount = {};
    existingOrders.forEach(o => {
      reservationsCount[o.timeSlotStart] = (reservationsCount[o.timeSlotStart] || 0) + 1;
    });

    const nowMorocco = new Date(new Date().getTime() + 60 * 60 * 1000);
    const todayMorocco = nowMorocco.toISOString().slice(0, 10);
    const isToday = date === todayMorocco;
    const nowMoroccoMinutes = isToday
      ? nowMorocco.getUTCHours() * 60 + nowMorocco.getUTCMinutes() + 30
      : 0;

    const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
    const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    const availableSlots = [];
    for (const config of configs) {
      const startMin = toMinutes(config.startTime);
      const endMin   = toMinutes(config.endTime);
      const step     = config.intervalMinutes;

      for (let cur = startMin; cur < endMin; cur += step) {
        const timeStr = toHHMM(cur);
        const endStr  = toHHMM(cur + step);

        if (isToday && cur < nowMoroccoMinutes) continue;

        const isBlocked = blockedSlots.some(b => {
          const bDate = b.date.toISOString().slice(0, 10);
          if (bDate !== date || !b.startTime) return false;
          const bStart = toMinutes(b.startTime);
          const bEnd   = b.endTime ? toMinutes(b.endTime) : 24 * 60;
          return cur >= bStart && cur < bEnd;
        });
        if (isBlocked) continue;

        const reservations = reservationsCount[timeStr] || 0;
        availableSlots.push({
          time: timeStr,
          endTime: endStr,
          capacity: config.capacity,
          reservations,
          available: reservations < config.capacity
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

    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    // Récupérer toutes les commandes dans la période
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: SALE_STATUSES }
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

    // Inclure TOUS les statuts actifs + COMPLETED — exclure uniquement CANCELLED/RETURNED/REFUNDED
    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: SALE_STATUSES }
      },
      select: {
        total: true,
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: { id: true, name: true, brand: true, image: true }
            }
          }
        }
      }
    });

    // Agréger uniquement les produits réellement commandés
    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!item.product) return;
        const pid = item.product.id;
        if (!productStats[pid]) {
          productStats[pid] = {
            productId: pid,
            productName: item.product.name,
            brand: item.product.brand,
            image: item.product.image,
            quantity: 0,
            revenue: 0,
            unitPrice: item.price
          };
        }
        productStats[pid].quantity += item.quantity;
        productStats[pid].revenue += item.price * item.quantity;
      });
    });

    const data = Object.values(productStats)
      .map(stat => ({
        ...stat,
        revenue: parseFloat(stat.revenue.toFixed(2)),
        avgUnitPrice: parseFloat(stat.unitPrice.toFixed(2))
      }))
      .sort((a, b) => b.revenue - a.revenue);

    res.json({ period: { startDate: start, endDate: end }, data });
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

    const SALE_STATUSES_CAT = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { in: SALE_STATUSES_CAT }
      },
      select: {
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                categoryId: true,
                category: { select: { id: true, name: true } }
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

    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { in: SALE_STATUSES } },
      select: {
        items: {
          select: {
            quantity: true, price: true,
            product: { select: { id: true, name: true, image: true, brand: true } }
          }
        }
      }
    });

    // Agréger uniquement les produits réellement commandés
    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!item.product) return;
        const pid = item.product.id;
        if (!productStats[pid]) {
          productStats[pid] = { productId: pid, productName: item.product.name, image: item.product.image, brand: item.product.brand, quantity: 0, revenue: 0 };
        }
        productStats[pid].quantity += item.quantity;
        productStats[pid].revenue += item.price * item.quantity;
      });
    });

    const data = Object.values(productStats)
      .map(s => ({ ...s, revenue: parseFloat(s.revenue.toFixed(2)) }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, parseInt(limit));

    res.json({ period: { startDate: start, endDate: end }, data });
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/bottom-products - Produits les moins vendus (parmi ceux qui ont été commandés)
router.get('/reports/bottom-products', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const SALE_STATUSES = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];

    // Ne récupérer QUE les produits qui ont été commandés dans la période
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: { in: SALE_STATUSES } },
      select: {
        items: {
          select: {
            quantity: true,
            product: { select: { id: true, name: true, image: true, brand: true } }
          }
        }
      }
    });

    // Agréger uniquement les produits réellement commandés
    const productStats = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        if (!item.product) return;
        const pid = item.product.id;
        if (!productStats[pid]) {
          productStats[pid] = {
            productId: pid,
            productName: item.product.name,
            image: item.product.image,
            brand: item.product.brand,
            quantity: 0
          };
        }
        productStats[pid].quantity += item.quantity;
      });
    });

    // Trier par quantité croissante — seuls les produits ayant au moins 1 vente
    const data = Object.values(productStats)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, parseInt(limit));

    res.json({ period: { startDate: start, endDate: end }, data });
  } catch (error) {
    console.error('Bottom products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/reports/weekly - Rapport hebdomadaire détaillé
router.get('/reports/weekly', verifyAdmin, async (req, res) => {
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
        user: {
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
          firstName: order.user?.firstName,
          lastName: order.user?.lastName,
          email: order.user?.email,
          phone: order.user?.phone,
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
    const { format = 'csv', startDate, endDate } = req.query;

    let reportData;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Récupérer les données selon le type
    if (type === 'products') {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: ['PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'COMPLETED'] }
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
              marque: item.product.brand || '-',
              quantité: 0,
              revenu: 0
            };
          }
          productStats[key].quantité += item.quantity;
          productStats[key].revenu += item.price * item.quantity;
        });
      });

      reportData = Object.values(productStats);
    } else if (type === 'top-products') {
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          status: { in: ['PREPARING', 'READY', 'PICKED_UP', 'DELIVERED', 'COMPLETED'] }
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
          if (!productStats[item.product.name]) {
            productStats[item.product.name] = {
              produit: item.product.name,
              marque: item.product.brand || '-',
              quantité: 0,
              revenu: 0
            };
          }
          productStats[item.product.name].quantité += item.quantity;
          productStats[item.product.name].revenu += item.price * item.quantity;
        });
      });

      reportData = Object.values(productStats)
        .sort((a, b) => b.quantité - a.quantité)
        .slice(0, 10);
    } else if (type === 'bottom-products') {
      const SALE_STATUSES_EXP = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED', 'PICKED_UP', 'DELIVERED'];
      const ordersExp = await prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end }, status: { in: SALE_STATUSES_EXP } },
        select: { items: { select: { quantity: true, product: { select: { id: true, name: true, brand: true } } } } }
      });
      const statsExp = {};
      ordersExp.forEach(o => o.items.forEach(item => {
        if (!item.product) return;
        const k = item.product.id;
        if (!statsExp[k]) statsExp[k] = { produit: item.product.name, marque: item.product.brand || '-', quantité: 0 };
        statsExp[k].quantité += item.quantity;
      }));
      reportData = Object.values(statsExp).sort((a, b) => a.quantité - b.quantité).slice(0, 10);
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
            date: dateStr,
            heure: order.timeSlotStart,
            réservées: 0,
            retirées: 0,
            annulées: 0
          };
        }
        slotStats[slotKey].réservées += 1;
        if (['PICKED_UP', 'DELIVERED'].includes(order.status)) {
          slotStats[slotKey].retirées += 1;
        }
        if (order.status === 'CANCELLED') {
          slotStats[slotKey].annulées += 1;
        }
      });

      reportData = Object.values(slotStats);
    } else {
      return res.status(400).json({ message: 'Type de rapport non supporté' });
    }

    if (format === 'pdf') {
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ 
        margin: 30,
        size: 'A4',
        autoFirstPage: true
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="rapport_${type}_${Date.now()}.pdf"`);
      
      doc.pipe(res);
      
      // Titre
      doc.fontSize(18).text(`Rapport: ${type}`, { align: 'center' });
      doc.moveDown();
      
      // Période
      doc.fontSize(12).text(`Période: ${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`);
      doc.moveDown();
      
      // Nombre de résultats
      doc.fontSize(11).text(`Total: ${reportData.length} enregistrements`);
      doc.moveDown();
      
      // Tableau des données
      if (reportData.length > 0) {
        const headers = Object.keys(reportData[0]);
        const tableTop = doc.y;
        const tableLeft = 30;
        const rowHeight = 20;
        const colWidth = (550 - tableLeft) / headers.length;
        
        // En-têtes (avec fond gris)
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          const x = tableLeft + (i * colWidth);
          doc.rect(x, tableTop, colWidth, rowHeight).fill('#f3f4f6').stroke();
          doc.text(header.substring(0, 15), x + 2, tableTop + 5, { width: colWidth - 4, align: 'left' });
        });
        
        // Données
        doc.font('Helvetica');
        let currentY = tableTop + rowHeight;
        
        reportData.forEach((row, rowIndex) => {
          // Vérifier si on doit créer une nouvelle page
          if (currentY + rowHeight > 780) {
            doc.addPage();
            currentY = 30;
          }
          
          headers.forEach((header, colIndex) => {
            const x = tableLeft + (colIndex * colWidth);
            const value = row[header] || '';
            // Ajouter " DH" pour les colonnes de revenus/prix
            const displayValue = (header.toLowerCase().includes('revenu') || header.toLowerCase().includes('prix')) 
              ? `${value} DH` 
              : String(value);
            doc.text(displayValue.substring(0, 15), x + 2, currentY + 5, { width: colWidth - 4, align: 'left' });
          });
          
          // Ligne de séparation
          doc.moveTo(tableLeft, currentY + rowHeight - 1).lineTo(tableLeft + (headers.length * colWidth), currentY + rowHeight - 1).stroke();
          currentY += rowHeight;
        });
      } else {
        doc.fontSize(12).text('Aucune donnée disponible pour cette période.', { align: 'center' });
      }
      
      doc.end();
    } else if (format === 'csv') {
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

// ===== GESTION DES SOUS-CATÉGORIES =====

// GET /admin/categories/subcategories - Récupérer toutes les sous-catégories avec leurs items
router.get('/categories/subcategories', verifyAdmin, async (req, res) => {
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
router.post('/categories/subcategories', verifyAdmin, async (req, res) => {
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
router.put('/categories/subcategories/:id', verifyAdmin, async (req, res) => {
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
router.delete('/categories/subcategories/:id', verifyAdmin, async (req, res) => {
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
router.get('/categories/subcategories/:id', verifyAdmin, async (req, res) => {
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
router.post('/categories/subcategories/:id/items', verifyAdmin, async (req, res) => {
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
router.put('/categories/items/:id', verifyAdmin, async (req, res) => {
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
router.delete('/categories/items/:id', verifyAdmin, async (req, res) => {
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

    // Gérer le tri spécial par nombre de commandes
    let orderByClause;
    if (sortBy === 'orderCount') {
      orderByClause = { orders: { _count: sortOrder } };
    } else {
      orderByClause = { [sortBy]: sortOrder };
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
        orderBy: orderByClause,
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
// backend/src/routes/admin.js
// Ajoutez ces routes à la fin du fichier, avant export default router

// ============ GESTION DES SOUS-CATÉGORIES ============

// GET - Récupérer toutes les sous-catégories
router.get('/categories/subcategories', verifyAdmin, async (req, res) => {
  try {
    const subcategories = await prisma.subcategory.findMany({
      include: {
        category: true,
        items: {
          orderBy: { order: 'asc' }
        }
      },
      orderBy: [
        { categoryId: 'asc' },
        { order: 'asc' }
      ]
    });
    
    res.json(subcategories);
  } catch (error) {
    console.error('Erreur récupération sous-catégories:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST - Créer une sous-catégorie
router.post('/categories/subcategories', verifyAdmin, async (req, res) => {
  try {
    const { title, icon, categoryId, order } = req.body;
    
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
    
    const subcategory = await prisma.subcategory.create({
      data: {
        title,
        icon: icon || null,
        categoryId,
        order: order || 0
      },
      include: {
        items: true
      }
    });
    
    res.status(201).json(subcategory);
  } catch (error) {
    console.error('Erreur création sous-catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT - Modifier une sous-catégorie
router.put('/categories/subcategories/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, icon, order } = req.body;
    
    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order })
      },
      include: {
        items: true
      }
    });
    
    res.json(subcategory);
  } catch (error) {
    console.error('Erreur modification sous-catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE - Supprimer une sous-catégorie
router.delete('/categories/subcategories/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la sous-catégorie existe
    const subcategory = await prisma.subcategory.findUnique({
      where: { id },
      include: {
        items: true
      }
    });
    
    if (!subcategory) {
      return res.status(404).json({ message: 'Sous-catégorie non trouvée' });
    }
    
    // Supprimer d'abord les items
    if (subcategory.items.length > 0) {
      await prisma.subcategoryItem.deleteMany({
        where: { subcategoryId: id }
      });
    }
    
    // Supprimer la sous-catégorie
    await prisma.subcategory.delete({
      where: { id }
    });
    
    res.json({ message: 'Sous-catégorie supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression sous-catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST - Ajouter un item à une sous-catégorie
router.post('/categories/subcategories/:subcategoryId/items', verifyAdmin, async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { name, order } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Nom de l\'item requis' });
    }
    
    const item = await prisma.subcategoryItem.create({
      data: {
        name,
        subcategoryId,
        order: order || 0
      }
    });
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Erreur création item:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT - Modifier un item
router.put('/categories/items/:itemId', verifyAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, order } = req.body;
    
    const item = await prisma.subcategoryItem.update({
      where: { id: itemId },
      data: {
        ...(name !== undefined && { name }),
        ...(order !== undefined && { order })
      }
    });
    
    res.json(item);
  } catch (error) {
    console.error('Erreur modification item:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE - Supprimer un item
router.delete('/categories/items/:itemId', verifyAdmin, async (req, res) => {
  try {
    const { itemId } = req.params;
    
    await prisma.subcategoryItem.delete({
      where: { id: itemId }
    });
    
    res.json({ message: 'Item supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression item:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DU STOCK =====

// GET /admin/stock/stats - Statistiques par produit avec ventes jour/semaine/mois et projection
router.get('/stock/stats', verifyAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Récupérer tous les produits actifs
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, image: true, brand: true, stock: true, stockAlert: true }
    });

    // Récupérer les mouvements de vente des 30 derniers jours
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const salesMovements = await prisma.stockMovement.findMany({
      where: { type: 'SALE', createdAt: { gte: thirtyDaysAgo } },
      select: { productId: true, quantity: true, createdAt: true }
    });

    // Agréger par produit
    const byProduct = {};
    products.forEach(p => {
      byProduct[p.id] = {
        productId: p.id,
        productName: p.name,
        brand: p.brand || '—',
        image: p.image || null,
        currentStock: p.stock,
        stockAlert: p.stockAlert,
        salesToday: 0,
        salesWeek: 0,
        salesMonth: 0,
        sales30d: 0,
      };
    });

    salesMovements.forEach(m => {
      if (!byProduct[m.productId]) return;
      const qty = Math.abs(m.quantity);
      const date = new Date(m.createdAt);
      byProduct[m.productId].sales30d += qty;
      if (date >= startOfMonth) byProduct[m.productId].salesMonth += qty;
      if (date >= startOfWeek) byProduct[m.productId].salesWeek += qty;
      if (date >= startOfDay) byProduct[m.productId].salesToday += qty;
    });

    // Calculer la projection (jours avant épuisement)
    const result = Object.values(byProduct).map(p => {
      const avgDaily = p.sales30d / 30;
      const daysUntilEmpty = avgDaily > 0 ? Math.floor(p.currentStock / avgDaily) : null;
      return { ...p, avgDaily: parseFloat(avgDaily.toFixed(2)), daysUntilEmpty };
    }).sort((a, b) => b.salesToday - a.salesToday);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/stock/movements - Historique des mouvements de stock
router.get('/stock/movements', verifyAdmin, async (req, res) => {
  try {
    const { productId, type, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, image: true, brand: true, stock: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.stockMovement.count({ where })
    ]);

    res.json({
      movements,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/stock/alerts - Produits en stock critique
router.get('/stock/alerts', verifyAdmin, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        stock: { lte: prisma.product.fields.stockAlert }
      },
      select: { id: true, name: true, image: true, brand: true, stock: true, stockAlert: true },
      orderBy: { stock: 'asc' }
    });
    res.json(products);
  } catch {
    // Fallback: fetch all and filter in JS
    const products = await prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, image: true, brand: true, stock: true, stockAlert: true },
      orderBy: { stock: 'asc' }
    });
    res.json(products.filter(p => p.stock <= p.stockAlert));
  }
});

// PUT /admin/stock/restock/:productId - Réapprovisionner manuellement
router.put('/stock/restock/:productId', verifyAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, reason } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ message: 'Quantité invalide' });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: 'Produit non trouvé' });

    const newStock = product.stock + parseInt(quantity);
    const [updated] = await Promise.all([
      prisma.product.update({ where: { id: productId }, data: { stock: newStock } }),
      prisma.stockMovement.create({
        data: {
          productId,
          type: 'RESTOCK',
          quantity: parseInt(quantity),
          reason: reason || 'Réapprovisionnement manuel',
          userId: req.userId
        }
      })
    ]);

    res.json({ message: 'Stock mis à jour', product: updated });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DES CAPACITÉS PAR CRÉNEAU =====

// GET /admin/time-slots/slot-capacities?dayOfWeek=1 - Lister les overrides d'un jour
router.get('/time-slots/slot-capacities', verifyAdmin, async (req, res) => {
  try {
    const { dayOfWeek } = req.query;
    const where = dayOfWeek !== undefined ? { dayOfWeek: parseInt(dayOfWeek) } : {};
    const overrides = await prisma.slotCapacityOverride.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { slotTime: 'asc' }]
    });
    res.json(overrides);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/time-slots/slot-capacities - Créer ou mettre à jour la capacité d'un créneau
router.put('/time-slots/slot-capacities', verifyAdmin, async (req, res) => {
  try {
    const { dayOfWeek, slotTime, capacity } = req.body;
    if (dayOfWeek === undefined || !slotTime || capacity === undefined) {
      return res.status(400).json({ message: 'dayOfWeek, slotTime et capacity requis' });
    }
    const override = await prisma.slotCapacityOverride.upsert({
      where: { dayOfWeek_slotTime: { dayOfWeek: parseInt(dayOfWeek), slotTime } },
      update: { capacity: parseInt(capacity) },
      create: { dayOfWeek: parseInt(dayOfWeek), slotTime, capacity: parseInt(capacity) }
    });
    res.json({ message: 'Capacité mise à jour', override });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/time-slots/slot-capacities/:id - Supprimer un override (revenir au défaut)
router.delete('/time-slots/slot-capacities/:id', verifyAdmin, async (req, res) => {
  try {
    await prisma.slotCapacityOverride.delete({ where: { id: req.params.id } });
    res.json({ message: 'Override supprimé, capacité par défaut restaurée' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ===== GESTION DES AVIS CLIENTS =====

// GET /admin/reviews - Tous les avis (approuvés + en attente)
router.get('/reviews', verifyAdmin, async (req, res) => {
  try {
    const { approved, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = approved !== undefined ? { approved: approved === 'true' } : {};

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, image: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.review.count({ where })
    ]);

    res.json({ reviews, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/reviews/:id/approve - Approuver un avis
router.put('/reviews/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { approved: true }
    });
    res.json({ message: 'Avis approuvé', review });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/reviews/:id - Supprimer un avis
router.delete('/reviews/:id', verifyAdmin, async (req, res) => {
  try {
    await prisma.review.delete({ where: { id: req.params.id } });
    res.json({ message: 'Avis supprimé' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;
