// backend/src/routes/categories.js
import express from 'express';
import prisma from '../prismaClient.js';
import { cacheGet, cacheSet, CACHE_KEYS, invalidateCategoryCache } from '../utils/redisCache.js';

const router = express.Router();

import { verifyAdmin } from '../middleware/auth.js';

// ============ ROUTES PUBLIQUES ============

// GET - Récupérer toutes les catégories (public)
router.get('/', async (req, res) => {
  try {
    const cacheKey = CACHE_KEYS.CATEGORIES_LIST;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const categories = await prisma.category.findMany({
      where: {
        NOT: { name: 'Promotions' } // Exclure la catégorie Promotions des listes publiques
      },
      include: {
        subcategories: {
          include: { items: true },
          orderBy: { order: 'asc' }
        },
        _count: { select: { products: true } }
      },
      orderBy: { order: 'asc' }
    });

    await cacheSet(cacheKey, categories, 7200); // Cache for 2 hours
    
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ============ ROUTES ADMIN POUR CATÉGORIES PRINCIPALES ============

// GET /api/categories/admin/all - Récupérer toutes les catégories (admin, y compris Promotions)
router.get('/admin/all', verifyAdmin, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subcategories: {
          include: { items: true },
          orderBy: { order: 'asc' }
        },
        _count: { select: { products: true } }
      },
      orderBy: { order: 'asc' }
    });
    
    res.json(categories);
  } catch (error) {
    console.error('Erreur récupération catégories admin:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/categories/admin/main - Créer une catégorie
router.post('/admin/main', verifyAdmin, async (req, res) => {
  try {
    const { name, icon, order } = req.body;
    if (!name) return res.status(400).json({ message: 'Le nom de la catégorie est requis' });

    // Check if name is unique
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });

const category = await prisma.category.create({
      data: {
        name,
        icon,
        order: order || 0
      }
    });
    await invalidateCategoryCache();
    res.status(201).json(category);
  } catch (error) {
    console.error('Erreur création catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /api/categories/admin/main/:id - Modifier une catégorie
router.put('/admin/main/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, order } = req.body;
    
    if (name) {
      const existing = await prisma.category.findFirst({ where: { name, NOT: { id } } });
      if (existing) return res.status(400).json({ message: 'Une catégorie avec ce nom existe déjà' });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order })
      }
    });
    await invalidateCategoryCache();
    res.json(category);
  } catch (error) {
    console.error('Erreur modification catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/categories/admin/main/:id - Supprimer une catégorie
router.delete('/admin/main/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query; // ?force=true pour suppression en cascade
    
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ message: 'Catégorie non trouvée' });
    
    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    
    if (productsCount > 0 && force !== 'true') {
      return res.status(400).json({ 
        message: `Cette catégorie contient ${productsCount} produit(s).`,
        productsCount,
        requiresForce: true
      });
    }

    // Suppression en cascade
    await prisma.$transaction(async (tx) => {
      if (productsCount > 0) {
        // Récupérer les IDs des produits de cette catégorie
        const products = await tx.product.findMany({
          where: { categoryId: id },
          select: { id: true }
        });
        const productIds = products.map(p => p.id);

        // Récupérer les IDs des variantes
        const variants = await tx.productVariant.findMany({
          where: { productId: { in: productIds } },
          select: { id: true }
        });
        const variantIds = variants.map(v => v.id);

        if (variantIds.length > 0) {
          await tx.stockMovement.deleteMany({ where: { variantId: { in: variantIds } } });
          await tx.orderItem.deleteMany({ where: { variantId: { in: variantIds } } });
        }
        await tx.stockMovement.deleteMany({ where: { productId: { in: productIds } } });
        await tx.orderItem.deleteMany({ where: { productId: { in: productIds } } });
        await tx.favorite.deleteMany({ where: { productId: { in: productIds } } });
        await tx.review.deleteMany({ where: { productId: { in: productIds } } });
        await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } });
        await tx.productImage.deleteMany({ where: { productId: { in: productIds } } });
        await tx.stockNotification.deleteMany({ where: { productId: { in: productIds } } });
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
      }
      await tx.subcategoryItem.deleteMany({ where: { subcategory: { categoryId: id } } });
      await tx.subcategory.deleteMany({ where: { categoryId: id } });
      await tx.category.delete({ where: { id } });
    });

    await invalidateCategoryCache();
    res.json({ message: 'Catégorie supprimée avec succès' });
  } catch (error) {
    console.error('Erreur suppression catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// ============ ROUTES ADMIN POUR SOUS-CATÉGORIES ============

// GET /api/categories/subcategories - Récupérer toutes les sous-catégories (admin)
router.get('/subcategories', verifyAdmin, async (req, res) => {
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

// GET /api/categories/admin/subcategories/:id - Récupérer une sous-catégorie par ID
router.get('/admin/subcategories/:id', verifyAdmin, async (req, res) => {
  try {
    const subcategory = await prisma.subcategory.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
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
    console.error('Erreur récupération sous-catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/categories/admin/subcategories - Créer une sous-catégorie
router.post('/admin/subcategories', verifyAdmin, async (req, res) => {
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

// PUT /api/categories/admin/subcategories/:id - Modifier une sous-catégorie
router.put('/admin/subcategories/:id', verifyAdmin, async (req, res) => {
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

// DELETE /api/categories/admin/subcategories/:id - Supprimer une sous-catégorie
router.delete('/admin/subcategories/:id', verifyAdmin, async (req, res) => {
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

// ============ ROUTES POUR LES ITEMS DE SOUS-CATÉGORIE ============

// POST /api/categories/admin/subcategories/:subcategoryId/items - Ajouter un item
router.post('/admin/subcategories/:subcategoryId/items', verifyAdmin, async (req, res) => {
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

// PUT /api/categories/admin/items/:itemId - Modifier un item
router.put('/admin/items/:itemId', verifyAdmin, async (req, res) => {
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

// DELETE /api/categories/admin/items/:itemId - Supprimer un item
router.delete('/admin/items/:itemId', verifyAdmin, async (req, res) => {
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

// GET - Récupérer une catégorie par ID (public)
router.get('/:id', async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: {
        products: true,
        subcategories: {
          include: { items: true }
        }
      }
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Catégorie non trouvée' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Erreur récupération catégorie:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;