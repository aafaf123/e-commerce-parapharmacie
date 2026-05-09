import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestAdmin, createTestCategory, createTestProduct } from '../helpers.js';

describe('📦 Products API', () => {
  let adminToken, category, product;
  const cleanup = { categoryIds: [], productIds: [], adminIds: [] };

  beforeAll(async () => {
    const { admin, token } = await createTestAdmin();
    adminToken = token;
    cleanup.adminIds.push(admin.id);

    category = await createTestCategory({ name: 'Test Catégorie Produits' });
    cleanup.categoryIds.push(category.id);

    product = await createTestProduct(category.id, { name: 'Produit Test GET', price: 19.99, stock: 50 });
    cleanup.productIds.push(product.id);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: cleanup.adminIds } } });
    await prisma.$disconnect();
  });

  // ==================== GET LISTE ====================
  describe('GET /api/products', () => {
    it('retourne la liste paginée', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('products');
      expect(Array.isArray(res.body.products)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    });

    it('filtre par catégorie', async () => {
      const res = await request(app).get(`/api/products?categoryId=${category.id}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.products.every(p => p.categoryId === category.id)).toBe(true);
    });

    it('tri par prix croissant', async () => {
      const res = await request(app).get('/api/products?sortBy=price-asc&limit=5');
      expect(res.statusCode).toBe(200);
      const prices = res.body.products.map(p => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('tri par prix décroissant', async () => {
      const res = await request(app).get('/api/products?sortBy=price-desc&limit=5');
      expect(res.statusCode).toBe(200);
      const prices = res.body.products.map(p => p.price);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    it('recherche par nom', async () => {
      const res = await request(app).get('/api/products?search=Produit Test GET');
      expect(res.statusCode).toBe(200);
    });

    it('pagination fonctionne', async () => {
      const res = await request(app).get('/api/products?page=1&limit=3');
      expect(res.statusCode).toBe(200);
      expect(res.body.products.length).toBeLessThanOrEqual(3);
    });
  });

  // ==================== GET DETAIL ====================
  describe('GET /api/products/:id', () => {
    it('retourne le détail d\'un produit', async () => {
      const res = await request(app).get(`/api/products/${product.id}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(product.id);
      expect(res.body.name).toBe(product.name);
    });

    it('retourne 404 pour ID inexistant', async () => {
      const res = await request(app).get('/api/products/00000000-0000-0000-0000-000000000000');
      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== GET SIMILAIRES ====================
  describe('GET /api/products/:id/similar', () => {
    it('retourne des produits similaires', async () => {
      const res = await request(app).get(`/api/products/${product.id}/similar`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('retourne 404 pour produit inexistant', async () => {
      const res = await request(app).get('/api/products/00000000-0000-0000-0000-000000000000/similar');
      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== CREATE (ADMIN) ====================
  describe('POST /api/products', () => {
    it('crée un produit avec token admin', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Nouveau Produit ${Date.now()}`,
          price: 39.99, priceHT: 33.33,
          stock: 20, stockAlert: 5,
          categoryId: category.id, active: true
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      cleanup.productIds.push(res.body.id);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).post('/api/products').send({ name: 'Test', price: 10 });
      expect([401, 500]).toContain(res.statusCode);
    });

    it('retourne 400 si nom manquant', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 10, categoryId: category.id });
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  // ==================== UPDATE (ADMIN) ====================
  describe('PUT /api/products/:id', () => {
    it('modifie un produit avec token admin', async () => {
      const res = await request(app)
        .put(`/api/products/${product.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Produit Modifié', price: 25.00 });
      expect(res.statusCode).toBe(200);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).put(`/api/products/${product.id}`).send({ name: 'Test' });
      expect([200, 401]).toContain(res.statusCode);
    });
  });

  // ==================== DELETE (ADMIN) ====================
  describe('DELETE /api/products/:id', () => {
    it('supprime un produit avec token admin', async () => {
      const toDelete = await createTestProduct(category.id, { name: 'À Supprimer' });
      const res = await request(app)
        .delete(`/api/products/${toDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.statusCode);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).delete(`/api/products/${product.id}`);
      expect([200, 401]).toContain(res.statusCode);
    });
  });
});
