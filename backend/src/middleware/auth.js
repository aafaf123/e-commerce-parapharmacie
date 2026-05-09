import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

export const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!['ADMIN', 'EMPLOYE', 'PREPARATEUR', 'CAISSIER'].includes(decoded.role)) {
      return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    }
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

export const verifyAdminOnly = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'ADMIN') return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
    req.userId = decoded.id;
    req.userRole = 'ADMIN';
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalide' });
  }
};
