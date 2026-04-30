import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

async function findUserByRole(id, role) {
  if (role === 'ADMIN') {
    return prisma.admin.findUnique({ where: { id }, select: { id: true, email: true, isActive: true } });
  }
  if (['EMPLOYE', 'PREPARATEUR', 'CAISSIER'].includes(role)) {
    return prisma.employee.findUnique({ where: { id }, select: { id: true, email: true, isActive: true } });
  }
  return prisma.client.findUnique({ where: { id }, select: { id: true, email: true, isActive: true } });
}

export const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token manquant' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['ADMIN', 'EMPLOYE', 'PREPARATEUR', 'CAISSIER'].includes(decoded.role)) {
      return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }
    const user = await findUserByRole(decoded.id, decoded.role);
    if (!user || !user.isActive) return res.status(403).json({ message: user ? 'Compte désactivé' : 'Accès refusé.' });
    req.userId = user.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

export const verifyAdminOnly = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token manquant' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN') return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    const user = await prisma.admin.findUnique({ where: { id: decoded.id }, select: { id: true, isActive: true } });
    if (!user || !user.isActive) return res.status(403).json({ message: user ? 'Compte désactivé' : 'Accès refusé.' });
    req.userId = user.id;
    req.userRole = 'ADMIN';
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};
