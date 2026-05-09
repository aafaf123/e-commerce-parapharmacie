import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestClient, createTestAdmin, createTestCategory, createTestProduct } from '../helpers.js';

describe('⭐ Reviews, Favorites & User Profile API', () => {
  let clientToken, client, product, category;
  const cleanup = { clientIds: [], adminIds: [], productIds: [], categoryIds: [], reviewIds: [] };

  beforeAll(async () => {
    const clientData = await createTestClient();
    client = clientData.client;
    clientToken = clientData.token;
    cleanup.clientIds.push(client.id);

    category = await createTestCategory({ name: 'Cat Reviews Test' });
    cleanup.categoryIds.push(category.id);

    product = await createTestProduct(category.id, { name: 'Produit Reviews Test', price: 12.00 });
    cleanup.productIds.push(product.id);
  });

  afterAll(async () => {
    await prisma.review.deleteMany({ where: { id: { in: cleanup.reviewIds } } });
    await prisma.favorite.deleteMany({ where: { clientId: { in: cleanup.clientIds } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.client.deleteMany({ where: { id: { in: cleanup.clientIds } } });
    await prisma.$disconnect();
  });

  // ==================== HEALTH ====================
  describe('GET /api/health', () => {
    it('retourne status OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('OK');
    });
  });

  // ==================== USER PROFILE ====================
  describe('GET /api/user/profile', () => {
    it('retourne le profil du client connecté', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.email).toBe(client.email);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/user/profile');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('met à jour le profil', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ firstName: 'Nouveau', lastName: 'Nom', phone: '0611111111' });
      expect(res.statusCode).toBe(200);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).put('/api/user/profile').send({ firstName: 'Test' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== REVIEWS ====================
  describe('GET /api/reviews/:productId', () => {
    it('retourne les avis d\'un produit', async () => {
      const res = await request(app).get(`/api/reviews/${product.id}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/reviews/:productId', () => {
    it('soumet un avis avec token', async () => {
      const res = await request(app)
        .post(`/api/reviews/${product.id}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ rating: 5, comment: 'Excellent produit!', name: 'Test Client' });
      expect([200, 201]).toContain(res.statusCode);
      if (res.body.review?.id) cleanup.reviewIds.push(res.body.review.id);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app)
        .post(`/api/reviews/${product.id}`)
        .send({ rating: 4, comment: 'Bien', name: 'Anonyme' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== FAVORITES ====================
  describe('POST /api/favorites/:productId', () => {
    it('ajoute un produit aux favoris', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: product.id });
      expect([200, 201]).toContain(res.statusCode);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .send({ productId: product.id });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/favorites', () => {
    it('retourne les favoris du client', async () => {
      const res = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.statusCode).toBe(200);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/favorites');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/favorites/:productId', () => {
    it('supprime un favori', async () => {
      const res = await request(app)
        .delete(`/api/favorites/${product.id}`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect([200, 204]).toContain(res.statusCode);
    });
  });

  // ==================== PROMOTIONS ====================
  describe('GET /api/promotions/active', () => {
    it('retourne les promotions actives (public)', async () => {
      const res = await request(app).get('/api/promotions/active');
      expect(res.statusCode).toBe(200);
    });
  });

  // ==================== EMPLOYEES (ADMIN) ====================
  describe('GET /api/admin/employees', () => {
    it('retourne la liste des employés', async () => {
      const { admin, token } = await createTestAdmin();
      cleanup.adminIds.push(admin.id);

      const res = await request(app)
        .get('/api/admin/employees')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/admin/employees/permissions/modules', () => {
    it('retourne les modules de permissions', async () => {
      const { admin, token } = await createTestAdmin();
      cleanup.adminIds.push(admin.id);

      const res = await request(app)
        .get('/api/admin/employees/permissions/modules')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some(m => m.key === 'purchase_orders')).toBe(true);
    });
  });
});
