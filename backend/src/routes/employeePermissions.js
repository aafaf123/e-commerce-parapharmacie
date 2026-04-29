import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAdmin, authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Liste centralisée des modules — correspond exactement aux pages admin
export const ADMIN_MODULES = [
  { key: 'products',           label: 'Produits',              path: '/admin/products' },
  { key: 'categories',         label: 'Catégories',            path: '/admin/categories' },
  { key: 'orders',             label: 'Commandes',             path: '/admin/orders' },
  { key: 'promotions',         label: 'Promotions',            path: '/admin/promotions' },
  { key: 'timeslots',          label: 'Créneaux horaires',     path: '/admin/time-slots' },
  { key: 'customers',          label: 'Clients/Utilisateurs',  path: '/admin/users' },
  { key: 'reports',            label: 'Rapports',              path: '/admin/reports' },
  { key: 'suppliers',          label: 'Fournisseurs',          path: '/admin/suppliers' },
  { key: 'purchase_orders',    label: 'Bons de commande',      path: '/admin/purchase-orders' },
  { key: 'supplier_discounts', label: 'Remises fournisseurs',  path: '/admin/supplier-discounts' },
  { key: 'inventory',          label: 'Gestion du stock',      path: '/admin/stock' },
  { key: 'reviews',            label: 'Avis clients',          path: '/admin/reviews' },
  { key: 'settings',           label: 'Paramètres',            path: '/admin/settings' },
];

// GET /api/admin/employees/permissions/modules — liste des modules (admin)
router.get('/modules', verifyAdmin, (req, res) => {
  res.json(ADMIN_MODULES);
});

// GET /api/admin/employees/permissions/my — permissions de l'employé connecté
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    // Admin = tous les droits
    if (user?.role === 'ADMIN') {
      const allPerms = {};
      ADMIN_MODULES.forEach(m => {
        allPerms[m.key] = { canView: true, canCreate: true, canEdit: true, canDelete: true };
      });
      return res.json({ permissions: allPerms });
    }

    // Employé = permissions depuis la base
    const rows = await prisma.employeePermission.findMany({
      where: { userId: req.userId }
    });

    const permissions = {};
    ADMIN_MODULES.forEach(m => {
      const row = rows.find(r => r.module === m.key);
      permissions[m.key] = row
        ? { canView: row.canView, canCreate: row.canCreate, canEdit: row.canEdit, canDelete: row.canDelete }
        : { canView: false, canCreate: false, canEdit: false, canDelete: false };
    });

    res.json({ permissions });
  } catch (error) {
    console.error('Get my permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/admin/employees/permissions/:userId — permissions d'un employé (admin)
router.get('/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true }
    });

    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (user.role !== 'EMPLOYE') return res.status(400).json({ message: 'Cet utilisateur n\'est pas un employé' });

    const rows = await prisma.employeePermission.findMany({ where: { userId } });

    const permissions = {};
    ADMIN_MODULES.forEach(m => {
      const row = rows.find(r => r.module === m.key);
      permissions[m.key] = row
        ? { canView: row.canView, canCreate: row.canCreate, canEdit: row.canEdit, canDelete: row.canDelete }
        : { canView: false, canCreate: false, canEdit: false, canDelete: false };
    });

    res.json({ user, permissions });
  } catch (error) {
    console.error('Get employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /api/admin/employees/permissions/:userId — mettre à jour les permissions (admin)
router.put('/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    if (user.role !== 'EMPLOYE') return res.status(400).json({ message: 'Cet utilisateur n\'est pas un employé' });

    // Upsert chaque module
    for (const m of ADMIN_MODULES) {
      const p = permissions[m.key] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
      await prisma.employeePermission.upsert({
        where: { userId_module: { userId, module: m.key } },
        update:  { canView: !!p.canView, canCreate: !!p.canCreate, canEdit: !!p.canEdit, canDelete: !!p.canDelete },
        create:  { userId, module: m.key, canView: !!p.canView, canCreate: !!p.canCreate, canEdit: !!p.canEdit, canDelete: !!p.canDelete }
      });
    }

    res.json({ message: 'Permissions mises à jour avec succès' });
  } catch (error) {
    console.error('Update employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
