import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAdmin } from '../middleware/auth.js';
import { checkEmployeePermission } from '../middleware/employeePermissions.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /admin/user/permissions - Récupérer les permissions de l'utilisateur connecté
router.get('/user/permissions', verifyAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, role: true, firstName: true, lastName: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Si c'est un admin, il a tous les droits
    if (user.role === 'ADMIN') {
      const allPermissions = {
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
        reviews: { canView: true, canCreate: true, canEdit: true, canDelete: true }
      };

      return res.json({
        user: {
          id: user.id,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        permissions: allPermissions
      });
    }

    // Pour les employés, récupérer leurs permissions spécifiques
    if (user.role === 'EMPLOYE' || user.role === 'PREPARATEUR' || user.role === 'CAISSIER') {
      const permissions = await prisma.employeePermission.findMany({
        where: { userId: user.id },
        orderBy: { module: 'asc' }
      });

      const permissionsMap = {};
      permissions.forEach(p => {
        permissionsMap[p.module] = {
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete
        };
      });

      return res.json({
        user: {
          id: user.id,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        permissions: permissionsMap
      });
    }

    // Aucune permission pour les autres rôles
    return res.json({
      user: {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      permissions: {}
    });

  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/check-access/:module - Vérifier l'accès à un module spécifique
router.get('/check-access/:module', verifyAdmin, async (req, res) => {
  try {
    const { module } = req.params;
    const { action = 'canView' } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Les admins ont tous les droits
    if (user.role === 'ADMIN') {
      return res.json({ hasAccess: true, role: user.role });
    }

    // Pour les employés, vérifier les permissions spécifiques
    if (user.role === 'EMPLOYE' || user.role === 'PREPARATEUR' || user.role === 'CAISSIER') {
      const permission = await prisma.employeePermission.findUnique({
        where: { userId_module: { userId: user.id, module } }
      });

      const hasAccess = permission ? permission[action] : false;
      return res.json({ hasAccess, role: user.role, module, action });
    }

    return res.json({ hasAccess: false, role: user.role });

  } catch (error) {
    console.error('Check access error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

export default router;