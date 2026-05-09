import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

const JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.JWT_SECRET = JWT_SECRET;

// ── Mock Prisma ──────────────────────────────────────────────────────────────
const mockPrisma = {
  admin:    { findUnique: jest.fn() },
  employee: { findUnique: jest.fn() },
  client:   { findUnique: jest.fn() },
};
jest.unstable_mockModule('../../src/prismaClient.js', () => ({ default: mockPrisma }));
jest.unstable_mockModule('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { authenticateToken, verifyAdmin, verifyAdminOnly } = await import('../../src/middleware/auth.js');

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET);
}

function mockReq(token) {
  return { headers: { authorization: token ? `Bearer ${token}` : undefined } };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// ── authenticateToken ────────────────────────────────────────────────────────
describe('authenticateToken', () => {
  it('retourne 401 si pas de token', () => {
    const req = mockReq(null);
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('retourne 401 si token invalide', () => {
    const req = mockReq('token_invalide');
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next() et set req.userId avec token valide', () => {
    const token = makeToken({ id: 'user-123', role: 'CLIENT' });
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-123');
    expect(req.userRole).toBe('CLIENT');
  });

  it('retourne 401 si token signé avec mauvais secret', () => {
    const token = jwt.sign({ id: 'user-123', role: 'CLIENT' }, 'mauvais_secret');
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('retourne 401 si token expiré', () => {
    const token = jwt.sign({ id: 'user-123', role: 'CLIENT' }, JWT_SECRET, { expiresIn: '-1s' });
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── verifyAdmin ──────────────────────────────────────────────────────────────
describe('verifyAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 401 si pas de token', async () => {
    const req = mockReq(null);
    const res = mockRes();
    const next = jest.fn();

    await verifyAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('retourne 403 si role CLIENT', async () => {
    const token = makeToken({ id: 'user-123', role: 'CLIENT' });
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    await verifyAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next() pour un admin actif', async () => {
    const token = makeToken({ id: 'admin-123', role: 'ADMIN' });
    mockPrisma.admin.findUnique.mockResolvedValue({ id: 'admin-123', email: 'a@a.com', isActive: true });

    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    await verifyAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('admin-123');
  });

  it('retourne 403 si admin désactivé', async () => {
    const token = makeToken({ id: 'admin-123', role: 'ADMIN' });
    mockPrisma.admin.findUnique.mockResolvedValue({ id: 'admin-123', isActive: false });

    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    await verifyAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next() pour un employé actif', async () => {
    const token = makeToken({ id: 'emp-123', role: 'EMPLOYE' });
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-123', email: 'e@e.com', isActive: true });

    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    await verifyAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

// ── verifyAdminOnly ──────────────────────────────────────────────────────────
describe('verifyAdminOnly', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne 403 si role EMPLOYE', async () => {
    const token = makeToken({ id: 'emp-123', role: 'EMPLOYE' });
    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    await verifyAdminOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('appelle next() pour un ADMIN actif', async () => {
    const token = makeToken({ id: 'admin-123', role: 'ADMIN' });
    mockPrisma.admin.findUnique.mockResolvedValue({ id: 'admin-123', isActive: true });

    const req = mockReq(token);
    const res = mockRes();
    const next = jest.fn();

    await verifyAdminOnly(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
