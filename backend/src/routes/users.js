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
        authProvider: true,
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
    console.log('📝 Mise à jour profil pour userId:', req.userId);
    console.log('📝 Données reçues:', req.body);
    
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

    // Validation du téléphone plus permissive
    if (phone && phone.trim() !== '') {
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[0-9]{8,15}$/.test(cleanPhone)) {
        return res.status(400).json({ message: 'Format de téléphone invalide (8-15 chiffres)' });
      }
    }
    
    // Validation WhatsApp si fourni
    if (whatsapp && whatsapp.trim() !== '') {
      const cleanWhatsApp = whatsapp.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[0-9]{8,15}$/.test(cleanWhatsApp)) {
        return res.status(400).json({ message: 'Format WhatsApp invalide (8-15 chiffres)' });
      }
    }
    
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone.trim();
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp ? whatsapp.trim() : '';
    if (address !== undefined) updateData.address = address;
    if (profileImage !== undefined) updateData.profileImage = profileImage || null;
    if (notificationEmail !== undefined) updateData.notificationEmail = notificationEmail;
    if (notificationSMS !== undefined) updateData.notificationSMS = notificationSMS;
    if (notificationWhatsApp !== undefined) updateData.notificationWhatsApp = notificationWhatsApp;
    if (notificationPush !== undefined) updateData.notificationPush = notificationPush;
    
    console.log('📝 Données à mettre à jour:', updateData);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
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

    console.log('✅ Profil mis à jour:', user);
    res.json({
      message: 'Profil mis à jour avec succès',
      user,
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    res.status(500).json({ message: 'Erreur serveur', details: error.message });
  }
});

// ==================== GESTION DES CRÉNEAUX EMPLOYÉS ====================

// GET - Récupérer mon horaire (pour un employé)
router.get('/employee/my-schedule', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'EMPLOYE') {
      return res.status(403).json({ message: 'Accès réservé aux employés' });
    }

    const schedules = await prisma.employeeSchedule.findMany({
      where: { employeeId: req.userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });

    res.json(schedules);
  } catch (error) {
    console.error('Get employee schedule error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET - Récupérer mes réservations/congés
router.get('/employee/my-reservations', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'EMPLOYE') {
      return res.status(403).json({ message: 'Accès réservé aux employés' });
    }

    const { status, startDate, endDate } = req.query;
    const where = { employeeId: req.userId };

    if (status) where.status = status;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate + 'T00:00:00.000Z');
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const reservations = await prisma.employeeSlotReservation.findMany({
      where,
      orderBy: { date: 'desc' }
    });

    res.json(reservations);
  } catch (error) {
    console.error('Get employee reservations error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// POST - Demander un congé/absence
router.post('/employee/request-leave', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'EMPLOYE') {
      return res.status(403).json({ message: 'Accès réservé aux employés' });
    }

    const { date, startTime, endTime, reason } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'date, startTime et endTime requis' });
    }

    const reservation = await prisma.employeeSlotReservation.create({
      data: {
        employeeId: req.userId,
        date: new Date(date + 'T00:00:00.000Z'),
        startTime,
        endTime,
        status: 'ACTIVE',
        reason: reason || 'Demande de congé'
      }
    });

    res.status(201).json({ message: 'Demande de congé créée', reservation });
  } catch (error) {
    console.error('Request leave error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Une réservation existe déjà pour ce créneau' });
    }
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT - Annuler mon congé/absence
router.put('/employee/reservations/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'EMPLOYE') {
      return res.status(403).json({ message: 'Accès réservé aux employés' });
    }

    const { id } = req.params;

    // Vérifier que la réservation appartient à l'employé
    const reservation = await prisma.employeeSlotReservation.findUnique({
      where: { id }
    });

    if (!reservation || reservation.employeeId !== req.userId) {
      return res.status(403).json({ message: 'Accès refusé' });
    }

    const updated = await prisma.employeeSlotReservation.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({ message: 'Réservation annulée', reservation: updated });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET - Voir les créneaux disponibles avec informations d'employés
router.get('/employee/available-shifts', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'EMPLOYE') {
      return res.status(403).json({ message: 'Accès réservé aux employés' });
    }

    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date requise' });
    }

    const targetDateStart = new Date(date + 'T00:00:00.000Z');
    const dayOfWeek = targetDateStart.getUTCDay();

    // Récupérer mes créneaux
    const mySchedules = await prisma.employeeSchedule.findMany({
      where: { employeeId: req.userId, dayOfWeek, isAvailable: true },
      orderBy: { startTime: 'asc' }
    });

    // Récupérer mes réservations pour ce jour
    const myReservations = await prisma.employeeSlotReservation.findMany({
      where: {
        employeeId: req.userId,
        date: { gte: targetDateStart, lte: new Date(date + 'T23:59:59.999Z') },
        status: 'ACTIVE'
      }
    });

    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    const shifts = [];

    for (const schedule of mySchedules) {
      const startMin = toMinutes(schedule.startTime);
      const endMin = toMinutes(schedule.endTime);

      // Suppose 60-minute slots
      for (let cur = startMin; cur < endMin; cur += 60) {
        const timeStr = toHHMM(cur);
        const endStr = toHHMM(cur + 60);

        // Check if I have a reservation for this slot
        const hasReservation = myReservations.some(res => {
          const resStart = toMinutes(res.startTime);
          const resEnd = toMinutes(res.endTime);
          return cur >= resStart && cur < resEnd;
        });

        shifts.push({
          scheduleId: schedule.id,
          time: timeStr,
          endTime: endStr,
          maxCapacity: schedule.maxCapacity,
          reserved: hasReservation,
          dayOfWeek: schedule.dayOfWeek
        });
      }
    }

    res.json(shifts);
  } catch (error) {
    console.error('Get available shifts error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;