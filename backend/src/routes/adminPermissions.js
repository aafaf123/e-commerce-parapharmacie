import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAdmin } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

const ALL_PERMISSIONS = {
  products: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  orders: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  reports: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  promotions: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  timeslots: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  suppliers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  categories: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  customers: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  inventory: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  settings: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  employees: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  reviews: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  purchase_orders: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  supplier_discounts: { canView: true, canCreate: true, canEdit: true, canDelete: true },
};

// GET /admin/user/permissions
router.get('/user/permissions', verifyAdmin, async (req, res) => {
  try {
    if (req.userRole === 'ADMIN') {
      const admin = await prisma.admin.findUnique({
        where: { id: req.userId },
        select: { id: true, firstName: true, lastName: true, email: true }
      });
      return res.json({ user: { ...admin, role: 'ADMIN' }, permissions: ALL_PERMISSIONS });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: req.userId },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    if (!employee) return res.status(404).json({ message: 'Employé non trouvé' });

    const rows = await prisma.employeePermission.findMany({ where: { employeeId: req.userId } });
    const permissions = {};
    rows.forEach(p => {
      permissions[p.module] = { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete };
    });

    return res.json({ user: { ...employee, role: req.userRole }, permissions });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /admin/check-access/:module
router.get('/check-access/:module', verifyAdmin, async (req, res) => {
  try {
    const { module } = req.params;
    const { action = 'canView' } = req.query;

    if (req.userRole === 'ADMIN') return res.json({ hasAccess: true, role: 'ADMIN' });

    const permission = await prisma.employeePermission.findUnique({
      where: { employeeId_module: { employeeId: req.userId, module } }
    });

    return res.json({ hasAccess: permission ? !!permission[action] : false, role: req.userRole, module, action });
  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

export default router;
