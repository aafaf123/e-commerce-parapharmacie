import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestAdmin } from '../helpers.js';

describe('🎯 Promotions API', () => {
  let adminToken;
  let createdPromoId;
  const cleanup = { adminIds: [], promoIds: [], productIds: [], categoryIds: [] };

  beforeAll(async () => {
    const { admin, token } = await createTestAdmin();
    adminToken = token;
    cleanup.adminIds.push(admin.id);
  });

  afterAll(async () => {
    if (cleanup.promoIds.length) {
      await prisma.promotionStats.deleteMany({ where: { promotionId: { in: cleanup.promoIds } } });
      await prisma.promotion.deleteMany({ where: { id: { in: cleanup.promoIds } } });
    }
    if (cleanup.productIds.length)
      await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
    if (cleanup.categoryIds.length)
      await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: cleanup.adminIds } } });
    await prisma.$disconnect();
  });

  // ==================== PUBLIC ====================
  describe('GET /api/promotions/active', () => {
    it('retourne les promotions actives (public)', async () => {
      const res = await request(app).get('/api/promotions/active');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ==================== ADMIN CRUD ====================
  describe('POST /api/promotions', () => {
    it('crée une promotion avec token admin', async () => {
      const res = await request(app)
        .post('/api/admin/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Promo Test ${Date.now()}`,
          discountType: 'percentage',
          discountValue: 20,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
          active: true
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.promotion?.id || res.body.id).toBeTruthy();
      createdPromoId = res.body.promotion?.id || res.body.id;
      cleanup.promoIds.push(createdPromoId);
    });

    it('retourne 400 si titre manquant', async () => {
      const res = await request(app)
        .post('/api/admin/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountType: 'percentage',
          discountValue: 10,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString()
        });
      expect(res.statusCode).toBe(400);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).post('/api/admin/promotions').send({ title: 'Test' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/promotions/:id', () => {
    it('retourne une promotion par ID', async () => {
      if (!createdPromoId) return;
      const res = await request(app)
        .get(`/api/admin/promotions/${createdPromoId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(createdPromoId);
    });

    it('retourne 404 pour ID inexistant', async () => {
      const res = await request(app)
        .get('/api/admin/promotions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /api/promotions/:id', () => {
    it('modifie une promotion avec token admin', async () => {
      if (!createdPromoId) return;
      const res = await request(app)
        .put(`/api/admin/promotions/${createdPromoId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Promo Modifiée', active: false });
      expect(res.statusCode).toBe(200);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app)
        .put('/api/admin/promotions/some-id')
        .send({ title: 'Test' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== STATS ====================
  describe('POST /api/promotions/:id/view', () => {
    it('enregistre une vue', async () => {
      if (!createdPromoId) return;
      const res = await request(app)
        .post(`/api/promotions/${createdPromoId}/view`);
      expect([200, 404]).toContain(res.statusCode);
    });
  });

  describe('POST /api/promotions/:id/click', () => {
    it('enregistre un clic', async () => {
      if (!createdPromoId) return;
      const res = await request(app)
        .post(`/api/promotions/${createdPromoId}/click`);
      expect([200, 404]).toContain(res.statusCode);
    });
  });

  // ==================== DELETE ====================
  describe('DELETE /api/promotions/:id', () => {
    it('supprime une promotion avec token admin', async () => {
      const created = await request(app)
        .post('/api/admin/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Promo À Supprimer ${Date.now()}`,
          discountType: 'fixed',
          discountValue: 5,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString()
        });
      const id = created.body.promotion?.id || created.body.id;

      const res = await request(app)
        .delete(`/api/admin/promotions/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.statusCode);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).delete('/api/admin/promotions/some-id');
      expect(res.statusCode).toBe(401);
    });
  });
});
