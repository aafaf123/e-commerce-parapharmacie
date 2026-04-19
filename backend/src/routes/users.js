import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/user/profile - Récupérer le profil utilisateur connecté
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        profileImage: true,
        whatsapp: true,
        notificationEmail: true,
        notificationSMS: true,
        notificationWhatsApp: true,
        notificationPush: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/user/search-history - Récupérer l'historique de recherche utilisateur
router.get('/search-history', authenticateToken, async (req, res) => {
  try {
    const searches = await prisma.searchHistory.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        query: true,
        createdAt: true,
      },
    });

    res.json({ searches });
  } catch (error) {
    console.error('Get search history error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/user/search-history - Enregistrer une recherche utilisateur
router.post('/search-history', authenticateToken, async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';

    if (!query) {
      return res.status(400).json({ message: 'La requête est requise' });
    }

    await prisma.searchHistory.deleteMany({
      where: {
        userId: req.userId,
        query: {
          equals: query,
          mode: 'insensitive',
        },
      },
    });

    const search = await prisma.searchHistory.create({
      data: {
        userId: req.userId,
        query,
      },
      select: {
        id: true,
        query: true,
        createdAt: true,
      },
    });

    const oldSearches = await prisma.searchHistory.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      select: { id: true },
    });

    if (oldSearches.length > 0) {
      await prisma.searchHistory.deleteMany({
        where: {
          id: {
            in: oldSearches.map((item) => item.id),
          },
        },
      });
    }

    res.status(201).json({
      message: 'Historique enregistré',
      search,
    });
  } catch (error) {
    console.error('Save search history error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/user/profile - Mettre à jour le profil utilisateur connecté
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      address,
      whatsapp,
      profileImage,
      notificationEmail,
      notificationSMS,
      notificationWhatsApp,
      notificationPush,
    } = req.body;

    // Validation basique
    if (!phone || !address) {
      return res.status(400).json({ message: 'Téléphone et adresse requis' });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        phone,
        address,
        ...(whatsapp !== undefined && { whatsapp }),
        ...(profileImage !== undefined && { profileImage: profileImage || null }),
        ...(notificationEmail !== undefined && { notificationEmail }),
        ...(notificationSMS !== undefined && { notificationSMS }),
        ...(notificationWhatsApp !== undefined && { notificationWhatsApp }),
        ...(notificationPush !== undefined && { notificationPush }),
        // firstName/lastName disabled dans frontend, pas mis à jour
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        profileImage: true,
        whatsapp: true,
        notificationEmail: true,
        notificationSMS: true,
        notificationWhatsApp: true,
        notificationPush: true,
      },
    });

    console.log(`✅ Profil mis à jour pour userId: ${req.userId}`);
    res.json({
      message: 'Profil mis à jour avec succès',
      user,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
});

export default router;