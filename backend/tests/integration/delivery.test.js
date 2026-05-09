import request from 'supertest';
import app from '../../src/app.js';
import { prisma } from '../helpers.js';

describe('🚚 Delivery API', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ==================== CITIES ====================
  describe('GET /api/delivery-zones/cities', () => {
    it('retourne la liste des villes de livraison', async () => {
      const res = await request(app).get('/api/delivery-zones/cities');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ==================== DISTRICTS ====================
  describe('GET /api/delivery-zones/districts', () => {
    it('retourne 400 si cityId manquant', async () => {
      const res = await request(app).get('/api/delivery-zones/districts');
      expect(res.statusCode).toBe(400);
    });

    it('retourne un tableau pour un cityId valide (même vide)', async () => {
      const res = await request(app).get('/api/delivery-zones/districts?cityId=00000000-0000-0000-0000-000000000000');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ==================== AVAILABLE DAYS ====================
  describe('GET /api/delivery-days/available', () => {
    it('retourne les jours disponibles (7 jours par défaut)', async () => {
      const res = await request(app).get('/api/delivery-days/available');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(7);
    });

    it('respecte le paramètre days', async () => {
      const res = await request(app).get('/api/delivery-days/available?days=3');
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(3);
    });

    it('chaque entrée a les champs requis', async () => {
      const res = await request(app).get('/api/delivery-days/available?days=2');
      expect(res.statusCode).toBe(200);
      res.body.forEach(day => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('available');
        expect(day).toHaveProperty('dayOfWeek');
      });
    });
  });

  // ==================== CONFIG ====================
  describe('GET /api/delivery-days/config', () => {
    it('retourne la configuration des jours de livraison', async () => {
      const res = await request(app).get('/api/delivery-days/config');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
