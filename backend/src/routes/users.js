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
        notificationEmail: true,
        notificationSMS: true,
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

// PUT /api/user/profile - Mettre à jour le profil utilisateur connecté
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      address,
      profileImage,
      notificationEmail,
      notificationSMS,
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
        ...(profileImage !== undefined && { profileImage: profileImage || null }),
        ...(notificationEmail !== undefined && { notificationEmail }),
        ...(notificationSMS !== undefined && { notificationSMS }),
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
        notificationEmail: true,
        notificationSMS: true,
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

