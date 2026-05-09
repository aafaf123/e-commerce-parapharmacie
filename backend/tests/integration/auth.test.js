import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestClient, createTestAdmin } from '../helpers.js';

const uniqueEmail = () => `test_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;

describe('🔐 Auth API', () => {
  const cleanup = { clientIds: [], adminIds: [] };

  afterAll(async () => {
    await prisma.client.deleteMany({ where: { id: { in: cleanup.clientIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: cleanup.adminIds } } });
    await prisma.$disconnect();
  });

  // ==================== SIGNUP ====================
  describe('POST /api/auth/signup', () => {
    it('crée un compte avec données valides', async () => {
      const email = uniqueEmail();
      const res = await request(app).post('/api/auth/signup').send({
        firstName: 'Jean', lastName: 'Dupont',
        email, password: 'Test1234!', phone: '0600000000'
      });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(email);
      const created = await prisma.client.findUnique({ where: { email } });
      if (created) cleanup.clientIds.push(created.id);
    });

    it('retourne 400 si email manquant', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        firstName: 'Jean', lastName: 'Dupont', password: 'Test1234!'
      });
      expect(res.statusCode).toBe(400);
    });

    it('retourne 400 si email déjà utilisé', async () => {
      const email = uniqueEmail();
      await request(app).post('/api/auth/signup').send({
        firstName: 'A', lastName: 'B', email, password: 'Test1234!', phone: '0600000000'
      });
      const res = await request(app).post('/api/auth/signup').send({
        firstName: 'C', lastName: 'D', email, password: 'Test1234!', phone: '0600000001'
      });
      expect(res.statusCode).toBe(400);
      const created = await prisma.client.findUnique({ where: { email } });
      if (created) cleanup.clientIds.push(created.id);
    });
  });

  // ==================== LOGIN ====================
  describe('POST /api/auth/login', () => {
    it('connexion valide retourne token', async () => {
      const { client, password } = await createTestClient();
      cleanup.clientIds.push(client.id);
      const res = await request(app).post('/api/auth/login').send({ email: client.email, password });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('CLIENT');
    });

    it('retourne 401 avec mauvais mot de passe', async () => {
      const { client } = await createTestClient();
      cleanup.clientIds.push(client.id);
      const res = await request(app).post('/api/auth/login').send({ email: client.email, password: 'WrongPass!' });
      expect(res.statusCode).toBe(401);
    });

    it('retourne 401 avec email inexistant', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'Test1234!' });
      expect(res.statusCode).toBe(401);
    });

    it('retourne 400 si champs manquants', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com' });
      expect(res.statusCode).toBe(400);
    });

    it('connexion admin via /api/auth/login', async () => {
      const { admin, password } = await createTestAdmin();
      cleanup.adminIds.push(admin.id);
      const res = await request(app).post('/api/auth/login').send({
        email: admin.email, password
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.user.role).toBe('ADMIN');
    });
  });

  // ==================== FORGOT PASSWORD ====================
  describe('POST /api/auth/forgot-password', () => {
    it('retourne 200 même si email inexistant (sécurité)', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });
      expect(res.statusCode).toBe(200);
    });

    it('retourne 200 pour email existant', async () => {
      const { client } = await createTestClient();
      cleanup.clientIds.push(client.id);
      const res = await request(app).post('/api/auth/forgot-password').send({ email: client.email });
      expect(res.statusCode).toBe(200);
    });

    it('retourne 400 si email manquant', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({});
      expect(res.statusCode).toBe(400);
    });
  });

  // ==================== RESET PASSWORD ====================
  describe('POST /api/auth/reset-password', () => {
    it('retourne 400 avec token invalide', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: 'invalid_token_xyz', password: 'NewPass1234!'
      });
      expect(res.statusCode).toBe(400);
    });

    it('retourne 400 si token manquant', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({ password: 'NewPass1234!' });
      expect(res.statusCode).toBe(400);
    });
  });
});
