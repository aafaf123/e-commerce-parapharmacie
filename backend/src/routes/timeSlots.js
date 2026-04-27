import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/time-slots/available - Récupérer les créneaux disponibles pour une date donnée (public)
router.get('/available', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date requise' });

    const targetDateStart = new Date(date + 'T00:00:00.000Z');
    const targetDateEnd = new Date(date + 'T23:59:59.999Z');
    const dayOfWeek = targetDateStart.getUTCDay();

    const configs = await prisma.timeSlotConfig.findMany({
      where: { dayOfWeek, active: true, type: 'STORE' },
      orderBy: { startTime: 'asc' }
    });

    const blockedSlots = await prisma.blockedSlot.findMany({ where: { active: true } });

    const existingOrders = await prisma.order.findMany({
      where: {
        timeSlotDate: { gte: targetDateStart, lte: targetDateEnd },
        timeSlotStart: { not: null },
        status: { notIn: ['CANCELLED', 'COMPLETED'] }
      },
      select: { timeSlotStart: true }
    });

    const reservationsCount = {};
    existingOrders.forEach(o => {
      reservationsCount[o.timeSlotStart] = (reservationsCount[o.timeSlotStart] || 0) + 1;
    });

    const now = new Date();
    const moroccoTimeStr = now.toLocaleString('en-US', { timeZone: 'Africa/Casablanca' });
    const nowMorocco = new Date(moroccoTimeStr);
    const todayMorocco = nowMorocco.toISOString().slice(0, 10);
    const isToday = date === todayMorocco;
    const currentMoroccoMinutes = isToday ? nowMorocco.getUTCHours() * 60 + nowMorocco.getUTCMinutes() : 0;
    const nowMoroccoMinutes = isToday ? Math.ceil(currentMoroccoMinutes / 30) * 30 : 0;

    const toMinutes = (hhmm) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    const toHHMM = (mins) => {
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    };

    const availableSlots = [];
    for (const config of configs) {
      const startMin = toMinutes(config.startTime);
      const endMin = toMinutes(config.endTime);
      const step = config.intervalMinutes;

      for (let cur = startMin; cur < endMin; cur += step) {
        const timeStr = toHHMM(cur);
        const endStr = toHHMM(cur + step);

        if (isToday && cur < nowMoroccoMinutes) continue;

        const isBlocked = blockedSlots.some(b => {
          const bDate = b.date.toISOString().slice(0, 10);
          if (bDate !== date || !b.startTime) return false;
          const bStart = toMinutes(b.startTime);
          const bEnd = b.endTime ? toMinutes(b.endTime) : 24 * 60;
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

export default router;