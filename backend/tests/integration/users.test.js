import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestClient } from '../helpers.js';

describe('👤 Users / Search History API', () => {
  let clientToken, client;
  const cleanup = { clientIds: [], searchHistoryIds: [] };

  beforeAll(async () => {
    const data = await createTestClient();
    client = data.client;
    clientToken = data.token;
    cleanup.clientIds.push(client.id);
  });

  afterAll(async () => {
    await prisma.searchHistory.deleteMany({ where: { clientId: { in: cleanup.clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: cleanup.clientIds } } });
    await prisma.$disconnect();
  });

  // ==================== PROFILE ====================
  describe('GET /api/user/profile', () => {
    it('retourne le profil du client connecté', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.email).toBe(client.email);
      expect(res.body).toHaveProperty('firstName');
      expect(res.body).not.toHaveProperty('password');
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/user/profile');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('met à jour firstName et lastName', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ firstName: 'Updated', lastName: 'Name', phone: '0611111111' });
      expect(res.statusCode).toBe(200);
      expect(res.body.user.firstName).toBe('Updated');
    });

    it('retourne 400 pour format téléphone invalide', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ phone: 'abc' });
      expect(res.statusCode).toBe(400);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).put('/api/user/profile').send({ firstName: 'X' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== SEARCH HISTORY ====================
  describe('POST /api/user/search-history', () => {
    it('enregistre une recherche', async () => {
      const res = await request(app)
        .post('/api/user/search-history')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ query: 'crème solaire' });
      expect(res.statusCode).toBe(201);
      expect(res.body.search.query).toBe('crème solaire');
    });

    it('retourne 400 si query vide', async () => {
      const res = await request(app)
        .post('/api/user/search-history')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ query: '' });
      expect(res.statusCode).toBe(400);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app)
        .post('/api/user/search-history')
        .send({ query: 'test' });
      expect(res.statusCode).toBe(401);
    });

    it('déduplique les recherches identiques', async () => {
      await request(app)
        .post('/api/user/search-history')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ query: 'doublon' });
      await request(app)
        .post('/api/user/search-history')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ query: 'doublon' });

      const res = await request(app)
        .get('/api/user/search-history')
        .set('Authorization', `Bearer ${clientToken}`);
      const queries = res.body.searches.map(s => s.query);
      const doublons = queries.filter(q => q === 'doublon');
      expect(doublons.length).toBe(1);
    });
  });

  describe('GET /api/user/search-history', () => {
    it('retourne l\'historique de recherche', async () => {
      const res = await request(app)
        .get('/api/user/search-history')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('searches');
      expect(Array.isArray(res.body.searches)).toBe(true);
      expect(res.body.searches.length).toBeLessThanOrEqual(5);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/user/search-history');
      expect(res.statusCode).toBe(401);
    });
  });
});
