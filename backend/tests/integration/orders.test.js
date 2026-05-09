import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestClient, createTestAdmin, createTestCategory, createTestProduct } from '../helpers.js';

describe('🛒 Orders API', () => {
  let clientToken, adminToken, client, product, category, createdOrderId;
  const cleanup = { clientIds: [], adminIds: [], productIds: [], categoryIds: [], orderIds: [] };

  beforeAll(async () => {
    const clientData = await createTestClient();
    client = clientData.client;
    clientToken = clientData.token;
    cleanup.clientIds.push(client.id);

    const adminData = await createTestAdmin();
    adminToken = adminData.token;
    cleanup.adminIds.push(adminData.admin.id);

    category = await createTestCategory({ name: 'Cat Orders Test' });
    cleanup.categoryIds.push(category.id);

    product = await createTestProduct(category.id, { name: 'Produit Order Test', price: 15.00, stock: 100 });
    cleanup.productIds.push(product.id);
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: cleanup.orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: cleanup.orderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.client.deleteMany({ where: { id: { in: cleanup.clientIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: cleanup.adminIds } } });
    await prisma.$disconnect();
  });

  // ==================== CREATE ORDER ====================
  describe('POST /api/orders/create', () => {
    it('crée une commande avec token client', async () => {
      const res = await request(app)
        .post('/api/orders/create')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          items: [{ id: product.id, name: product.name, price: product.price, quantity: 2 }],
          total: product.price * 2,
          paymentMethod: 'cash'
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('order');
      expect(res.body.order).toHaveProperty('orderNumber');
      createdOrderId = res.body.order.id;
      cleanup.orderIds.push(createdOrderId);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).post('/api/orders/create').send({
        items: [{ id: product.id, price: 15, quantity: 1 }], total: 15
      });
      expect(res.statusCode).toBe(401);
    });

    it('retourne 400 si panier vide', async () => {
      const res = await request(app)
        .post('/api/orders/create')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ items: [], total: 0 });
      expect(res.statusCode).toBe(400);
    });

    it('permet de commander même si stock = 0', async () => {
      const outOfStockProduct = await createTestProduct(category.id, {
        name: 'Produit Rupture', price: 10.00, stock: 0
      });
      cleanup.productIds.push(outOfStockProduct.id);

      const res = await request(app)
        .post('/api/orders/create')
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          items: [{ id: outOfStockProduct.id, name: outOfStockProduct.name, price: 10, quantity: 1 }],
          total: 10
        });
      expect(res.statusCode).toBe(201);
      cleanup.orderIds.push(res.body.order.id);
    });
  });

  // ==================== MY ORDERS ====================
  describe('GET /api/orders/my-orders', () => {
    it('retourne les commandes du client connecté', async () => {
      const res = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${clientToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('orders');
      expect(Array.isArray(res.body.orders)).toBe(true);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/orders/my-orders');
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== GET ALL (ADMIN) ====================
  describe('GET /api/orders', () => {
    it('retourne toutes les commandes', async () => {
      const res = await request(app).get('/api/orders');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body) || res.body.orders).toBeTruthy();
    });
  });

  // ==================== GET BY ID ====================
  describe('GET /api/orders/:id', () => {
    it('retourne une commande par ID', async () => {
      if (!createdOrderId) return;
      const res = await request(app).get(`/api/orders/${createdOrderId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(createdOrderId);
    });

    it('retourne 404 pour ID inexistant', async () => {
      const res = await request(app).get('/api/orders/00000000-0000-0000-0000-000000000000');
      expect(res.statusCode).toBe(404);
    });
  });

  // ==================== CANCEL ORDER ====================
  describe('PUT /api/orders/:id/cancel', () => {
    it('annule une commande du client', async () => {
      if (!createdOrderId) return;
      const res = await request(app)
        .put(`/api/orders/${createdOrderId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`);
      expect([200, 400]).toContain(res.statusCode);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).put(`/api/orders/some-id/cancel`);
      expect(res.statusCode).toBe(401);
    });
  });

  // ==================== ADMIN STATUS UPDATE ====================
  describe('PUT /api/admin/orders/:id/status', () => {
    it('change le statut d\'une commande (admin)', async () => {
      // Créer une nouvelle commande pour ce test
      const newOrder = await prisma.order.create({
        data: {
          orderNumber: `ORD-TEST-${Date.now()}`,
          status: 'RECEIVED',
          total: 15.00,
          clientId: client.id
        }
      });
      cleanup.orderIds.push(newOrder.id);

      const res = await request(app)
        .put(`/api/admin/orders/${newOrder.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PREPARING' });
      expect(res.statusCode).toBe(200);
    });

    it('retourne 401 sans token admin', async () => {
      const res = await request(app)
        .put('/api/admin/orders/some-id/status')
        .send({ status: 'PREPARING' });
      expect(res.statusCode).toBe(401);
    });
  });
});
