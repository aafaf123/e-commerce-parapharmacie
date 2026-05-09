import request from 'supertest';
import { fileURLToPath } from 'url';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_only';

// Créer un client de test et retourner son token
export async function createTestClient(overrides = {}) {
  const email = overrides.email || `client_${Date.now()}@test.com`;
  const password = overrides.password || 'Test1234!';
  const hash = await bcrypt.hash(password, 10);

  const client = await prisma.client.create({
    data: {
      firstName: 'Test',
      lastName: 'Client',
      email,
      password: hash,
      phone: '0600000000',
      isActive: true,
      ...overrides,
      password: hash
    }
  });

  const token = jwt.sign({ id: client.id, email: client.email, role: 'CLIENT' }, JWT_SECRET, { expiresIn: '1h' });
  return { client, token, password };
}

// Créer un admin de test
export async function createTestAdmin(overrides = {}) {
  const email = overrides.email || `admin_${Date.now()}@test.com`;
  const password = overrides.password || 'Admin1234!';
  const hash = await bcrypt.hash(password, 10);

  const admin = await prisma.admin.create({
    data: {
      firstName: 'Test',
      lastName: 'Admin',
      email,
      password: hash,
      isActive: true,
      isSuperAdmin: false,
      ...overrides,
      password: hash
    }
  });

  const token = jwt.sign({ id: admin.id, email: admin.email, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });
  return { admin, token, password };
}

// Créer un employé de test
export async function createTestEmployee(overrides = {}) {
  const email = overrides.email || `employee_${Date.now()}@test.com`;
  const password = overrides.password || 'Emp1234!';
  const hash = await bcrypt.hash(password, 10);

  const employee = await prisma.employee.create({
    data: {
      firstName: 'Test',
      lastName: 'Employee',
      email,
      password: hash,
      isActive: true,
      ...overrides,
      password: hash
    }
  });

  const token = jwt.sign({ id: employee.id, email: employee.email, role: 'EMPLOYE' }, JWT_SECRET, { expiresIn: '1h' });
  return { employee, token, password };
}

// Créer une catégorie de test
export async function createTestCategory(overrides = {}) {
  const { active, ...rest } = overrides; // active n'existe pas dans le schema
  return prisma.category.create({
    data: {
      name: `Cat_${Date.now()}`,
      icon: 'test',
      ...rest
    }
  });
}

// Créer un produit de test
export async function createTestProduct(categoryId, overrides = {}) {
  return prisma.product.create({
    data: {
      name: `Produit_${Date.now()}`,
      price: 29.99,
      priceHT: 24.99,
      stock: 100,
      stockAlert: 10,
      active: true,
      categoryId,
      ...overrides
    }
  });
}

// Créer un fournisseur de test
export async function createTestSupplier(overrides = {}) {
  return prisma.supplier.create({
    data: {
      name: `Fournisseur_${Date.now()}`,
      email: `supplier_${Date.now()}@test.com`,
      phone: '0600000000',
      active: true,
      ...overrides
    }
  });
}

// Nettoyer les données créées pendant un test
export async function cleanupTestData(ids = {}) {
  if (ids.orderIds?.length) await prisma.order.deleteMany({ where: { id: { in: ids.orderIds } } });
  if (ids.productIds?.length) await prisma.product.deleteMany({ where: { id: { in: ids.productIds } } });
  if (ids.categoryIds?.length) await prisma.category.deleteMany({ where: { id: { in: ids.categoryIds } } });
  if (ids.clientIds?.length) await prisma.client.deleteMany({ where: { id: { in: ids.clientIds } } });
  if (ids.adminIds?.length) await prisma.admin.deleteMany({ where: { id: { in: ids.adminIds } } });
  if (ids.employeeIds?.length) await prisma.employee.deleteMany({ where: { id: { in: ids.employeeIds } } });
  if (ids.supplierIds?.length) await prisma.supplier.deleteMany({ where: { id: { in: ids.supplierIds } } });
  if (ids.brandIds?.length) await prisma.brand.deleteMany({ where: { id: { in: ids.brandIds } } });
  if (ids.promoCodeIds?.length) await prisma.promoCode.deleteMany({ where: { id: { in: ids.promoCodeIds } } });
}

export { app, request };
