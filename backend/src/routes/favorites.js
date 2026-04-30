// backend/src/routes/favorites.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware d'authentification
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token manquant' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token invalide' });
  }
};

// GET - Récupérer les favoris de l'utilisateur
router.get('/', verifyToken, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { clientId: req.userId },
      include: {
        product: {
          include: {
            category: true,
            productImages: true
          }
        }
      }
    });
    
    const favoriteProducts = favorites.map(fav => fav.product);
    res.json(favoriteProducts);
  } catch (error) {
    console.error('Erreur récupération favoris:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST - Ajouter aux favoris
router.post('/', verifyToken, async (req, res) => {
  try {
    const { productId } = req.body;
    
    // Vérifier si déjà en favori
    const existing = await prisma.favorite.findFirst({
      where: {
        clientId: req.userId,
        productId
      }
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Produit déjà en favori' });
    }
    
    const favorite = await prisma.favorite.create({
      data: {
        clientId: req.userId,
        productId
      },
      include: {
        product: true
      }
    });
    
    res.status(201).json(favorite.product);
  } catch (error) {
    console.error('Erreur ajout favori:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE - Retirer des favoris
router.delete('/:productId', verifyToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    await prisma.favorite.deleteMany({
      where: {
        clientId: req.userId,
        productId
      }
    });
    
    res.json({ message: 'Produit retiré des favoris' });
  } catch (error) {
    console.error('Erreur suppression favori:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;