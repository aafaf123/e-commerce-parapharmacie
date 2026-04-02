// backend/src/routes/suppliers.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware pour vérifier si l'utilisateur est admin
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true, isActive: true }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'CAISSIER' && user.role !== 'PREPARATEUR')) {
      return res.status(403).json({ message: 'Accès refusé' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ message: 'Compte désactivé' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

// ============ ROUTES FOURNISSEURS ============

// GET /api/admin/suppliers - Récupérer tous les fournisseurs
router.get('/suppliers', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, active } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Récupérer les fournisseurs avec le comptage des produits
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          products: {
            select: { productId: true }  // Pour compter les produits
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.supplier.count({ where })
    ]);

    // Ajouter le comptage des produits manuellement
    const suppliersWithCount = suppliers.map(supplier => ({
      ...supplier,
      _count: {
        products: supplier.products.length
      },
      products: undefined // Retirer la liste des produits pour la réponse
    }));

    res.json({
      suppliers: suppliersWithCount,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST /api/admin/suppliers - Créer un fournisseur
router.post('/suppliers', verifyAdmin, async (req, res) => {
  try {
    const { name, contactName, email, phone, address, website, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Le nom du fournisseur est requis' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        description: description || null,
        active: active !== undefined ? active : true
      }
    });

    res.status(201).json({ message: 'Fournisseur créé avec succès', supplier });
  } catch (error) {
    console.error('Create supplier error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Ce fournisseur existe déjà' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /api/admin/suppliers/:id - Modifier un fournisseur
router.put('/suppliers/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactName, email, phone, address, website, description, active } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(contactName !== undefined && { contactName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(website !== undefined && { website }),
        ...(description !== undefined && { description }),
        ...(active !== undefined && { active })
      }
    });

    res.json({ message: 'Fournisseur modifié avec succès', supplier });
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /api/admin/suppliers/:id - Supprimer un fournisseur
router.delete('/suppliers/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { products: true }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Fournisseur non trouvé' });
    }

    if (supplier.products.length > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer, ${supplier.products.length} produit(s) lié(s) à ce fournisseur` 
      });
    }

    await prisma.supplier.delete({ where: { id } });

    res.json({ message: 'Fournisseur supprimé avec succès' });
  } catch (error) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/admin/suppliers/:id/products - Produits d'un fournisseur
router.get('/suppliers/:id/products', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const products = await prisma.productSupplier.findMany({
      where: { supplierId: id },
      include: {
        product: {
          include: {
            category: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(products);
  } catch (error) {
    console.error('Get supplier products error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;