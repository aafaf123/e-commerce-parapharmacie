import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAdmin, authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

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

// GET /modules — liste des modules
router.get('/modules', verifyAdmin, (req, res) => {
  res.json(ADMIN_MODULES);
});

// GET /my — permissions de l'employé connecté
router.get('/my', authenticateToken, async (req, res) => {
  try {
    // Admin = tous les droits
    if (req.userRole === 'ADMIN') {
      const allPerms = {};
      ADMIN_MODULES.forEach(m => {
        allPerms[m.key] = { canView: true, canCreate: true, canEdit: true, canDelete: true };
      });
      return res.json({ permissions: allPerms });
    }

    const rows = await prisma.employeePermission.findMany({
      where: { employeeId: req.userId }
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

// GET /:employeeId — permissions d'un employé (admin)
router.get('/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    if (!employee) return res.status(404).json({ message: 'Employé non trouvé' });

    const rows = await prisma.employeePermission.findMany({ where: { employeeId: userId } });

    const permissions = {};
    ADMIN_MODULES.forEach(m => {
      const row = rows.find(r => r.module === m.key);
      permissions[m.key] = row
        ? { canView: row.canView, canCreate: row.canCreate, canEdit: row.canEdit, canDelete: row.canDelete }
        : { canView: false, canCreate: false, canEdit: false, canDelete: false };
    });

    res.json({ user: employee, permissions });
  } catch (error) {
    console.error('Get employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// PUT /:employeeId — mettre à jour les permissions (admin)
router.put('/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    const employee = await prisma.employee.findUnique({ where: { id: userId } });
    if (!employee) return res.status(404).json({ message: 'Employé non trouvé' });

    for (const m of ADMIN_MODULES) {
      const p = permissions[m.key] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
      await prisma.employeePermission.upsert({
        where: { employeeId_module: { employeeId: userId, module: m.key } },
        update:  { canView: !!p.canView, canCreate: !!p.canCreate, canEdit: !!p.canEdit, canDelete: !!p.canDelete },
        create:  { employeeId: userId, module: m.key, canView: !!p.canView, canCreate: !!p.canCreate, canEdit: !!p.canEdit, canDelete: !!p.canDelete }
      });
    }

    res.json({ message: 'Permissions mises à jour avec succès' });
  } catch (error) {
    console.error('Update employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
