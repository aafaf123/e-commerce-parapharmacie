import express from 'express'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const router = express.Router()
const prisma = new PrismaClient()
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
      select: { id: true, email: true, role: true }
    });

    if (!user || (user.role !== 'ADMIN' && user.role !== 'EMPLOYE')) {
      return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }

    req.userId = user.id;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

// GET /api/promo-codes - Récupérer tous les codes promo avec pagination et filtrage
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, active } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Construire la clause where
    const where = {};
    if (active !== undefined) {
      where.active = active === 'true';
    }

    // Compter le total
    const total = await prisma.promoCode.count({ where });

    // Récupérer les codes promo
    const promoCodes = await prisma.promoCode.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' }
    });

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      promoCodes,
      pagination: {
        total,
        totalPages,
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des codes promo:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/promo-codes/validate - Valider un code promo
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Code promo requis' })
    }

    const promoCode = await prisma.promoCode.findFirst({
      where: {
        code: code.toUpperCase(),
        active: true,
      },
    })

    if (!promoCode) {
      return res.status(404).json({ error: 'Code promo invalide' })
    }

    // Vérifier l'expiration
    if (promoCode.expiryDate && new Date(promoCode.expiryDate) < new Date()) {
      return res.status(400).json({ error: 'Code promo expiré' })
    }

    // Vérifier la limite d'utilisation
    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
      return res.status(400).json({ error: 'Limite d\'utilisation atteinte' })
    }

    res.json(promoCode)
  } catch (error) {
    console.error('Erreur lors de la validation du code promo:', error)
    res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default router
