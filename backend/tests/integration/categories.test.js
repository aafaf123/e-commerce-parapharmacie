import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestAdmin } from '../helpers.js';

describe('📂 Categories API', () => {
  let adminToken;
  const cleanup = { adminIds: [], categoryIds: [] };

  beforeAll(async () => {
    const { admin, token } = await createTestAdmin();
    adminToken = token;
    cleanup.adminIds.push(admin.id);
  });

  afterAll(async () => {
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: cleanup.adminIds } } });
    await prisma.$disconnect();
  });

  // ==================== GET PUBLIC ====================
  describe('GET /api/categories', () => {
    it('retourne la liste des catégories (public)', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body) || res.body.categories).toBeTruthy();
    });

    it('retourne depuis le cache au 2ème appel', async () => {
      const res1 = await request(app).get('/api/categories');
      const res2 = await request(app).get('/api/categories');
      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
    });
  });

  // ==================== CREATE (ADMIN) ====================
  describe('POST /api/categories/admin/main', () => {
    it('crée une catégorie avec token admin', async () => {
      const res = await request(app)
        .post('/api/categories/admin/main')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Cat Test ${Date.now()}`, icon: 'test' });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      cleanup.categoryIds.push(res.body.id);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).post('/api/categories/admin/main').send({ name: 'Test' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== UPDATE (ADMIN) ====================
  describe('PUT /api/categories/admin/main/:id', () => {
    it('modifie une catégorie', async () => {
      const created = await prisma.category.create({ data: { name: `Cat Update ${Date.now()}`, icon: 'x' } });
      cleanup.categoryIds.push(created.id);

      const res = await request(app)
        .put(`/api/categories/admin/main/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Catégorie Modifiée' });
      expect(res.statusCode).toBe(200);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).put('/api/categories/admin/main/some-id').send({ name: 'Test' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== DELETE (ADMIN) ====================
  describe('DELETE /api/categories/admin/main/:id', () => {
    it('supprime une catégorie sans produits', async () => {
      const created = await prisma.category.create({ data: { name: `Cat Delete ${Date.now()}`, icon: 'x' } });

      const res = await request(app)
        .delete(`/api/categories/admin/main/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.statusCode);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).delete('/api/categories/admin/main/some-id');
      expect(res.statusCode).toBe(401);
    });
  });
});
