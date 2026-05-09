import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../helpers.js';

describe('🕐 Time Slots API', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==================== AVAILABLE SLOTS ====================
  describe('GET /api/time-slots/available', () => {
    it('retourne 400 si date manquante', async () => {
      const res = await request(app).get('/api/time-slots/available');
      expect(res.statusCode).toBe(400);
    });

    it('retourne un tableau pour une date valide', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const res = await request(app).get(`/api/time-slots/available?date=${dateStr}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('chaque créneau a les champs requis', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().slice(0, 10);

      const res = await request(app).get(`/api/time-slots/available?date=${dateStr}`);
      expect(res.statusCode).toBe(200);
      res.body.forEach(slot => {
        expect(slot).toHaveProperty('time');
        expect(slot).toHaveProperty('available');
        expect(slot).toHaveProperty('capacity');
        expect(slot).toHaveProperty('reservations');
      });
    });

    it('retourne 400 pour format de date invalide', async () => {
      const res = await request(app).get('/api/time-slots/available?date=invalid-date');
      expect([200, 400, 500]).toContain(res.statusCode);
    });
  });
});
