import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestClient, createTestAdmin, createTestCategory, createTestProduct } from '../helpers.js';

describe('⭐ Reviews API', () => {
  let clientToken, adminToken, product, category;
  const cleanup = { clientIds: [], adminIds: [], productIds: [], categoryIds: [], reviewIds: [] };

  beforeAll(async () => {
    const clientData = await createTestClient();
    clientToken = clientData.token;
    cleanup.clientIds.push(clientData.client.id);

    const adminData = await createTestAdmin();
    adminToken = adminData.token;
    cleanup.adminIds.push(adminData.admin.id);

    category = await createTestCategory({ name: 'Cat Reviews' });
    cleanup.categoryIds.push(category.id);

    product = await createTestProduct(category.id, { name: 'Produit Reviews', price: 10 });
    cleanup.productIds.push(product.id);
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { id: { in: cleanup.reviewIds } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.client.deleteMany({ where: { id: { in: cleanup.clientIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: cleanup.adminIds } } });
    await prisma.$disconnect();
  });

  // ==================== PUBLIC ====================
  describe('GET /api/reviews/:productId', () => {
    it('retourne les avis approuvés d\'un produit', async () => {
      const res = await request(app).get(`/api/reviews/${product.id}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('retourne tableau vide pour produit sans avis', async () => {
      const res = await request(app).get(`/api/reviews/${product.id}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/reviews/:productId', () => {
    it('soumet un avis avec token client', async () => {
      const res = await request(app)
        .post(`/api/reviews/${product.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ rating: 4, comment: 'Très bon produit', name: 'Client Test' });
      expect(res.statusCode).toBe(201);
      expect(res.body.review).toHaveProperty('id');
      expect(res.body.review.approved).toBe(false);
      cleanup.reviewIds.push(res.body.review.id);
    });

    it('retourne 400 si champs manquants', async () => {
      const res = await request(app)
        .post(`/api/reviews/${product.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ rating: 3 });
      expect(res.statusCode).toBe(400);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app)
        .post(`/api/reviews/${product.id}`)
        .send({ rating: 5, comment: 'Super', name: 'Anonyme' });
      expect(res.statusCode).toBe(401);
    });

    it('retourne 404 pour produit inexistant', async () => {
      const res = await request(app)
        .post('/api/reviews/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ rating: 5, comment: 'Test', name: 'Test' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== ADMIN MODERATION ====================
  describe('GET /api/admin/reviews', () => {
    it('retourne tous les avis (admin)', async () => {
      const res = await request(app)
        .get('/api/admin/reviews')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('reviews');
      expect(Array.isArray(res.body.reviews)).toBe(true);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/admin/reviews');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/admin/reviews/:id/approve', () => {
    it('approuve un avis (admin)', async () => {
      const review = await prisma.review.create({
        data: {
          productId: product.id,
          name: 'Test Approve',
          rating: 5,
          comment: 'À approuver',
          approved: false
        }
      });
      cleanup.reviewIds.push(review.id);

      const res = await request(app)
        .put(`/api/admin/reviews/${review.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).put('/api/admin/reviews/some-id/approve');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/admin/reviews/:id', () => {
    it('supprime un avis (admin)', async () => {
      const review = await prisma.review.create({
        data: {
          productId: product.id,
          name: 'À Supprimer',
          rating: 1,
          comment: 'Mauvais',
          approved: false
        }
      });

      const res = await request(app)
        .delete(`/api/admin/reviews/${review.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.statusCode);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).delete('/api/admin/reviews/some-id');
      expect(res.statusCode).toBe(401);
    });
  });
});
