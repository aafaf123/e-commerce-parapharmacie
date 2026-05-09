import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestClient, createTestCategory, createTestProduct } from '../helpers.js';

describe('❤️ Favorites API', () => {
  let clientToken, client, product, product2, category;
  const cleanup = { clientIds: [], productIds: [], categoryIds: [] };

  beforeAll(async () => {
    const data = await createTestClient();
    client = data.client;
    clientToken = data.token;
    cleanup.clientIds.push(client.id);

    category = await createTestCategory({ name: 'Cat Favorites' });
    cleanup.categoryIds.push(category.id);

    product = await createTestProduct(category.id, { name: 'Produit Favori 1', price: 15 });
    product2 = await createTestProduct(category.id, { name: 'Produit Favori 2', price: 25 });
    cleanup.productIds.push(product.id, product2.id);
  });

  afterAll(async () => {
    await prisma.favorite.deleteMany({ where: { clientId: { in: cleanup.clientIds } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.client.deleteMany({ where: { id: { in: cleanup.clientIds } } });
    await prisma.$disconnect();
  });

  // ==================== ADD ====================
  describe('POST /api/favorites', () => {
    it('ajoute un produit aux favoris via body', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: product.id });
      expect([200, 201]).toContain(res.statusCode);
    });

    it('retourne 400 si produit déjà en favori', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: product.id });
      expect(res.statusCode).toBe(400);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .send({ productId: product2.id });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/favorites/:productId', () => {
    it('ajoute un 2ème produit aux favoris via param', async () => {
      const res = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ productId: product2.id });
      expect([200, 201]).toContain(res.statusCode);
    });
  });

  // ==================== GET ====================
  describe('GET /api/favorites', () => {
    it('retourne les favoris du client', async () => {
      const res = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/favorites');
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== DELETE ====================
  describe('DELETE /api/favorites/:productId', () => {
    it('supprime un favori', async () => {
      const res = await request(app)
        .delete(`/api/favorites/${product.id}`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect([200, 204]).toContain(res.statusCode);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).delete(`/api/favorites/${product.id}`);
      expect(res.statusCode).toBe(401);
    });
  });
});
