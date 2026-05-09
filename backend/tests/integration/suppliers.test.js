import request from 'supertest';
import app from '../../src/app.js';
import { prisma, createTestAdmin, createTestSupplier, createTestCategory, createTestProduct } from '../helpers.js';

describe('🏭 Suppliers & Purchase Orders API', () => {
  let adminToken, supplier, product, category;
  const cleanup = { adminIds: [], supplierIds: [], categoryIds: [], productIds: [], purchaseOrderIds: [] };

  beforeAll(async () => {
    const { admin, token } = await createTestAdmin();
    adminToken = token;
    cleanup.adminIds.push(admin.id);

    supplier = await createTestSupplier({ name: `Fournisseur Test ${Date.now()}` });
    cleanup.supplierIds.push(supplier.id);

    category = await createTestCategory({ name: 'Cat Supplier Test' });
    cleanup.categoryIds.push(category.id);

    product = await createTestProduct(category.id, { name: 'Produit Supplier Test', price: 20 });
    cleanup.productIds.push(product.id);
  });

  afterAll(async () => {
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: cleanup.purchaseOrderIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: cleanup.purchaseOrderIds } } });
    await prisma.product.deleteMany({ where: { id: { in: cleanup.productIds } } });
    await prisma.category.deleteMany({ where: { id: { in: cleanup.categoryIds } } });
    await prisma.supplier.deleteMany({ where: { id: { in: cleanup.supplierIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: cleanup.adminIds } } });
    await prisma.$disconnect();
  });

  // ==================== SUPPLIERS ====================
  describe('GET /api/admin/suppliers', () => {
    it('retourne la liste des fournisseurs', async () => {
      const res = await request(app)
        .get('/api/admin/suppliers')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('suppliers');
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).get('/api/admin/suppliers');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/admin/suppliers', () => {
    it('crée un fournisseur', async () => {
      const res = await request(app)
        .post('/api/admin/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Nouveau Fournisseur ${Date.now()}`,
          email: `supplier_new_${Date.now()}@test.com`,
          phone: '0600000001', active: true
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.supplier?.id || res.body.id).toBeTruthy();
      cleanup.supplierIds.push(res.body.supplier?.id || res.body.id);
    });

    it('retourne 401 sans token', async () => {
      const res = await request(app).post('/api/admin/suppliers').send({ name: 'Test' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /api/admin/suppliers/:id', () => {
    it('modifie un fournisseur', async () => {
      const res = await request(app)
        .put(`/api/admin/suppliers/${supplier.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Fournisseur Modifié' });
      expect(res.statusCode).toBe(200);
    });
  });

  // ==================== PURCHASE ORDERS ====================
  describe('GET /api/admin/purchase-orders', () => {
    it('retourne la liste des bons de commande', async () => {
      const res = await request(app)
        .get('/api/admin/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('orders');
    });
  });

  describe('POST /api/admin/purchase-orders', () => {
    it('crée un bon de commande', async () => {
      const res = await request(app)
        .post('/api/admin/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          supplierId: supplier.id,
          items: [{ productId: product.id, quantity: 10, unitPrice: 15.00 }],
          notes: 'Test bon de commande'
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.order?.id || res.body.id).toBeTruthy();
      cleanup.purchaseOrderIds.push(res.body.order?.id || res.body.id);
    });

    it('retourne 400 si fournisseur manquant', async () => {
      const res = await request(app)
        .post('/api/admin/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ productId: product.id, quantity: 5, unitPrice: 10 }] });
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  describe('GET /api/admin/purchase-orders/auto-generate', () => {
    it('génère automatiquement les bons', async () => {
      const res = await request(app)
        .get('/api/admin/purchase-orders/auto-generate')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('bySupplier');
      expect(res.body).toHaveProperty('totalProducts');
    });
  });

  describe('DELETE /api/admin/purchase-orders/:id', () => {
    it('supprime un bon de commande en brouillon', async () => {
      const po = await prisma.purchaseOrder.create({
        data: {
          orderNumber: `BC-DEL-${Date.now()}`,
          supplierId: supplier.id,
          status: 'BROUILLON',
          totalAmount: 0,
          orderDate: new Date()
        }
      });

      const res = await request(app)
        .delete(`/api/admin/purchase-orders/${po.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 204]).toContain(res.statusCode);
    });
  });
});
