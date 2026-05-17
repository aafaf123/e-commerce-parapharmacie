// backend/src/routes/promotions.js
import express from 'express'
import prisma from '../prismaClient.js'
import jwt from 'jsonwebtoken'
import { cacheGet, cacheSet, cacheDel, CACHE_KEYS } from '../utils/redisCache.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware pour vérifier si l'utilisateur est admin (accepter ADMIN et EMPLOYE)
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token manquant' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { isActive: true }
    });

    if (!admin || !admin.isActive) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

// ============ ROUTES PUBLIQUES ============

// GET /api/promotions/active - Récupérer les promotions actives pour le slider
router.get('/active', async (req, res) => {
  try {
    const cached = await cacheGet(CACHE_KEYS.PROMOTIONS_ACTIVE);
    if (cached) return res.json(cached);

    const promotions = await prisma.promotion.findMany({
      where: { active: true },
      orderBy: { order: 'asc' }
    })

    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const promotionsWithFullUrls = promotions.map(p => ({
      ...p,
      bannerImage: p.bannerImage && !p.bannerImage.startsWith('http')
        ? `${baseUrl}${p.bannerImage.startsWith('/') ? '' : '/'}${p.bannerImage}`
        : p.bannerImage,
      productImage: p.productImage && !p.productImage.startsWith('http')
        ? `${baseUrl}${p.productImage.startsWith('/') ? '' : '/'}${p.productImage}`
        : p.productImage
    }));

    await cacheSet(CACHE_KEYS.PROMOTIONS_ACTIVE, promotionsWithFullUrls, 300); // 5 min
    res.json(promotionsWithFullUrls)
  } catch (error) {
    console.error('Erreur promotions actives:', error)
    res.status(500).json({ error: 'Erreur serveur', details: error.message })
  }
})
// GET /api/promotions/:id - Récupérer une promotion par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: { stats: true }
    })
    
    if (!promotion) {
      return res.status(404).json({ error: 'Promotion non trouvée' })
    }
    
    res.json(promotion)
  } catch (error) {
    console.error('Erreur récupération promotion:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/promotions/:id/get-or-create-product
// Retourne le productId réel lié à la promotion,
// ou crée un produit temporaire en base si aucun n'est lié.
router.post('/:id/get-or-create-product', async (req, res) => {
  try {
    const { id } = req.params

    const promo = await prisma.promotion.findUnique({ where: { id } })
    if (!promo) return res.status(404).json({ error: 'Promotion introuvable' })

    // Si un vrai produit est déjà lié, le retourner directement
    if (promo.productId) {
      const product = await prisma.product.findUnique({ where: { id: promo.productId } })
      if (product) return res.json({ productId: product.id })
    }

    // Trouver ou créer la catégorie "Promotions" (cachée des listes publiques)
    let promoCategory = await prisma.category.findFirst({ where: { name: 'Promotions' } })
    if (!promoCategory) {
      promoCategory = await prisma.category.create({
        data: {
          name: 'Promotions',
          icon: 'Tag',
          order: 999 // Mettre en dernier
        }
      })
    }

    // Créer un produit réel en base à partir des données de la promotion
    // MAIS dans la catégorie "Promotions" qui est exclue des listes publiques
    const product = await prisma.product.create({
      data: {
        name: promo.productName || promo.title,
        description: promo.description || promo.subtitle || '',
        price: promo.price || 0,
        oldPrice: promo.oldPrice || null,
        image: promo.productImage || promo.bannerImage || null,
        brand: promo.badge || null,
        stock: promo.stock || 999,
        stockAlert: 5,
        categoryId: promoCategory.id, // Utiliser la catégorie "Promotions"
        active: true, // Actif mais dans une catégorie cachée
      }
    })

    // Lier le produit créé à la promotion pour les prochains appels
    await prisma.promotion.update({
      where: { id },
      data: { productId: product.id }
    })

    res.json({ productId: product.id })
  } catch (error) {
    console.error('get-or-create-product error:', error)
    res.status(500).json({ error: 'Erreur serveur', details: error.message })
  }
})

// POST /api/promotions/:id/view - Enregistrer une vue
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params
    
    const stats = await prisma.promotionStats.upsert({
      where: { promotionId: id },
      update: { impressions: { increment: 1 } },
      create: { promotionId: id, impressions: 1 }
    })
    
    res.json(stats)
  } catch (error) {
    console.error('Erreur enregistrement vue:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/promotions/:id/click - Enregistrer un clic
router.post('/:id/click', async (req, res) => {
  try {
    const { id } = req.params
    
    const stats = await prisma.promotionStats.upsert({
      where: { promotionId: id },
      update: { clicks: { increment: 1 } },
      create: { promotionId: id, clicks: 1 }
    })
    
    res.json(stats)
  } catch (error) {
    console.error('Erreur enregistrement clic:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// ============ ROUTES ADMIN ============

// GET /api/promotions - Récupérer toutes les promotions (admin)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, active } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const where = {}
    if (active !== undefined) {
      where.active = active === 'true'
    }
    
    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include: { stats: true },
        orderBy: { order: 'asc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.promotion.count({ where })
    ])
    
    res.json({
      promotions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Erreur récupération promotions:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /api/promotions - Créer une promotion (admin)
router.post('/', verifyAdmin, async (req, res) => {
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
    } = req.body
    
    console.log('📝 [Promotions] Creating promotion:', { title, startDate, endDate, discountValue })
    
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Titre et dates requis' })
    }
    
    const promotion = await prisma.promotion.create({
      data: {
        title,
        description,
        subtitle,
        bannerImage,
        discountType: discountType || 'percentage',
        discountValue: parseFloat(discountValue) || 0,
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
    })
    
    // Créer les statistiques vides
    await prisma.promotionStats.create({
      data: { promotionId: promotion.id }
    })
    await cacheDel(CACHE_KEYS.PROMOTIONS_ACTIVE);
    res.status(201).json(promotion)
  } catch (error) {
    console.error('❌ [Promotions] Create promotion error:', error)
    res.status(500).json({ error: 'Erreur serveur', details: error.message })
  }
})

// PUT /api/promotions/:id - Modifier une promotion (admin)
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params
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
    } = req.body
    
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(subtitle !== undefined && { subtitle }),
        ...(bannerImage !== undefined && { bannerImage }),
        ...(discountType && { discountType }),
        ...(discountValue !== undefined && { discountValue: parseFloat(discountValue) }),
        ...(oldPrice !== undefined && { oldPrice: oldPrice ? parseFloat(oldPrice) : null }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
        ...(stock !== undefined && { stock: stock ? parseInt(stock) : null }),
        ...(rating !== undefined && { rating: rating ? parseFloat(rating) : null }),
        ...(productId !== undefined && { productId }),
        ...(productName !== undefined && { productName }),
        ...(productImage !== undefined && { productImage }),
        ...(badge !== undefined && { badge }),
        ...(badgeColor !== undefined && { badgeColor }),
        ...(bgColor !== undefined && { bgColor }),
        ...(iconName !== undefined && { iconName }),
        ...(features !== undefined && { features }),
        ...(ctaText !== undefined && { ctaText }),
        ...(active !== undefined && { active }),
        ...(order !== undefined && { order }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) })
      }
    })
    
    res.json(promotion)
  } catch (error) {
    console.error('Erreur modification promotion:', error)
    res.status(500).json({ error: 'Erreur serveur', details: error.message })
  }
})

// DELETE /api/promotions/:id - Supprimer une promotion (admin)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    // Supprimer les statistiques d'abord
    await prisma.promotionStats.deleteMany({
      where: { promotionId: id }
    })
    
    await prisma.promotion.delete({
      where: { id }
    })
    
    res.json({ message: 'Promotion supprimée' })
  } catch (error) {
    console.error('Erreur suppression promotion:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router