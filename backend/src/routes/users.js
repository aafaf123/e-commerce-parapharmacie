import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/user/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.client.findUnique({
      where: { id: req.userId },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, address: true, profileImage: true, whatsapp: true,
        notificationEmail: true, notificationSMS: true,
        notificationWhatsApp: true, notificationPush: true, authProvider: true,
      },
    });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/user/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, address, whatsapp, profileImage,
      notificationEmail, notificationSMS, notificationWhatsApp, notificationPush } = req.body;

    if (phone && phone.trim() !== '') {
      const clean = phone.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[0-9]{8,15}$/.test(clean)) return res.status(400).json({ message: 'Format de téléphone invalide' });
    }
    if (whatsapp && whatsapp.trim() !== '') {
      const clean = whatsapp.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[0-9]{8,15}$/.test(clean)) return res.status(400).json({ message: 'Format WhatsApp invalide' });
    }

    const data = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (phone !== undefined) data.phone = phone.trim();
    if (whatsapp !== undefined) data.whatsapp = whatsapp ? whatsapp.trim() : '';
    if (address !== undefined) data.address = address;
    if (profileImage !== undefined) data.profileImage = profileImage || null;
    if (notificationEmail !== undefined) data.notificationEmail = notificationEmail;
    if (notificationSMS !== undefined) data.notificationSMS = notificationSMS;
    if (notificationWhatsApp !== undefined) data.notificationWhatsApp = notificationWhatsApp;
    if (notificationPush !== undefined) data.notificationPush = notificationPush;

    const user = await prisma.client.update({
      where: { id: req.userId },
      data,
      select: {
        id: true, firstName: true, lastName: true, email: true,
        phone: true, address: true, profileImage: true, whatsapp: true,
        notificationEmail: true, notificationSMS: true,
        notificationWhatsApp: true, notificationPush: true,
      },
    });

    res.json({ message: 'Profil mis à jour avec succès', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
});

// GET /api/user/search-history
router.get('/search-history', authenticateToken, async (req, res) => {
  try {
    const searches = await prisma.searchHistory.findMany({
      where: { clientId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, query: true, createdAt: true },
    });
    res.json({ searches });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/user/search-history
router.post('/search-history', authenticateToken, async (req, res) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!query) return res.status(400).json({ message: 'La requête est requise' });

    await prisma.searchHistory.deleteMany({
      where: { clientId: req.userId, query: { equals: query, mode: 'insensitive' } },
    });

    const search = await prisma.searchHistory.create({
      data: { clientId: req.userId, query },
      select: { id: true, query: true, createdAt: true },
    });

    const old = await prisma.searchHistory.findMany({
      where: { clientId: req.userId },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      select: { id: true },
    });
    if (old.length > 0) {
      await prisma.searchHistory.deleteMany({ where: { id: { in: old.map(s => s.id) } } });
    }

    res.status(201).json({ message: 'Historique enregistré', search });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
