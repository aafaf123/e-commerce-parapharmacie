// backend/src/routes/delivery.js
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/delivery-zones/cities - Récupérer toutes les villes de livraison
router.get('/zones/cities', async (req, res) => {
  try {
    const cities = await prisma.deliveryCity.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true
      }
    });

    res.json(cities);
  } catch (error) {
    console.error('Get delivery cities error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/delivery-zones/districts - Récupérer les quartiers d'une ville
router.get('/zones/districts', async (req, res) => {
  try {
    const { cityId } = req.query;
    
    if (!cityId) {
      return res.status(400).json({ message: 'ID de ville requis' });
    }

    const districts = await prisma.deliveryDistrict.findMany({
      where: { 
        cityId,
        active: true 
      },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        order: true
      }
    });

    res.json(districts);
  } catch (error) {
    console.error('Get delivery districts error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/delivery-days/available - Récupérer les jours de livraison disponibles
router.get('/days/available', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysToCheck = parseInt(days);
    
    // Générer les dates à vérifier
    const availableDays = [];
    const today = new Date();
    
    for (let i = 1; i <= daysToCheck; i++) { // Commencer à demain (i=1)
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      const dateStr = checkDate.toISOString().slice(0, 10); // YYYY-MM-DD
      const dayOfWeek = checkDate.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
      
      // Vérifier s'il y a une configuration pour ce jour
      const dayConfig = await prisma.deliveryDayConfig.findUnique({
        where: { dayOfWeek }
      });
      
      if (!dayConfig || !dayConfig.active) {
        // Pas de livraison ce jour-là
        availableDays.push({
          date: dateStr,
          dayOfWeek,
          available: false,
          reason: 'Pas de livraison ce jour'
        });
        continue;
      }
      
      // Vérifier les créneaux bloqués
      const blockedSlot = await prisma.blockedSlot.findFirst({
        where: {
          date: checkDate,
          active: true
        }
      });
      
      if (blockedSlot) {
        availableDays.push({
          date: dateStr,
          dayOfWeek,
          available: false,
          reason: blockedSlot.reason || 'Jour bloqué'
        });
        continue;
      }
      
      // Compter les commandes existantes pour ce jour
      const startOfDay = new Date(checkDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(checkDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const existingOrders = await prisma.order.count({
        where: {
          timeSlotDate: {
            gte: startOfDay,
            lte: endOfDay
          },
          type: 'DELIVERY',
          status: {
            notIn: ['CANCELLED', 'COMPLETED']
          }
        }
      });
      
      // Vérifier si la capacité est dépassée
      const isAvailable = existingOrders < dayConfig.capacity;
      
      availableDays.push({
        date: dateStr,
        dayOfWeek,
        startTime: dayConfig.startTime,
        endTime: dayConfig.endTime,
        capacity: dayConfig.capacity,
        reservations: existingOrders,
        available: isAvailable
      });
    }
    
    res.json(availableDays);
  } catch (error) {
    console.error('Get available delivery days error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /api/delivery-days/config - Récupérer la configuration des jours de livraison (admin)
router.get('/days/config', async (req, res) => {
  try {
    const configs = await prisma.deliveryDayConfig.findMany({
      orderBy: { dayOfWeek: 'asc' }
    });
    
    res.json(configs);
  } catch (error) {
    console.error('Get delivery config error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;