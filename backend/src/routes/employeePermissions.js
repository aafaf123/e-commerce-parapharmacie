import express from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyAdmin } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /admin/employees/permissions/modules - Lister tous les modules disponibles
router.get('/modules', (req, res) => {
   const modules = [
     {
       key: 'products',
       label: 'Produits',
       description: 'Gestion du catalogue produits (ajout, modification, suppression, visualisation)'
     },
     {
       key: 'orders',
       label: 'Commandes',
       description: 'Gestion des commandes clients (consultation, modification de statut)'
     },
     {
       key: 'reports',
       label: 'Rapports',
       description: 'Accès aux rapports statistiques et analyses'
     },
     {
       key: 'promotions',
       label: 'Promotions',
       description: 'Gestion des promotions et codes promo'
     },
     {
       key: 'timeslots',
       label: 'Créneaux horaires',
       description: 'Gestion des créneaux de retrait et calendrier'
     },
     {
       key: 'suppliers',
       label: 'Fournisseurs',
       description: 'Gestion des fournisseurs et commandes fournisseurs'
     },
     {
       key: 'categories',
       label: 'Catégories',
       description: 'Gestion des catégories et sous-catégories'
     },
     {
       key: 'customers',
       label: 'Clients',
       description: 'Gestion des comptes clients'
     },
     {
       key: 'inventory',
       label: 'Inventaire',
       description: 'Gestion des stocks et mouvements'
     },
     {
       key: 'settings',
       label: 'Paramètres',
       description: 'Configuration générale du système'
     },
     {
       key: 'employees',
       label: 'Employés',
       description: 'Gestion des comptes employés et permissions'
     }
   ];

   res.json(modules);
});

// GET /admin/employees/:id/permissions - Récupérer toutes les permissions d'un employé
router.get('/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Vérifier que l'utilisateur est bien un employé
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (user.role !== 'EMPLOYE' && user.role !== 'PREPARATEUR' && user.role !== 'CAISSIER') {
      return res.status(400).json({ message: 'Cet utilisateur n\'est pas un employé' });
    }

    // Récupérer les permissions existantes
    const permissions = await prisma.employeePermission.findMany({
      where: { userId },
      orderBy: { module: 'asc' }
    });

    // Retourner un objet clé par module pour faciliter l'usage frontend
    const permissionsMap = {};
    permissions.forEach(p => {
      permissionsMap[p.module] = {
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete
      };
    });

    res.json({ userId, permissions: permissionsMap });
  } catch (error) {
    console.error('Get employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// PUT /admin/employees/:id/permissions - Mettre à jour les permissions d'un employé
router.put('/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body; // { products: { canView: true, canCreate: false, ... }, ... }

    // Vérifier que l'utilisateur est bien un employé
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (user.role !== 'EMPLOYE' && user.role !== 'PREPARATEUR' && user.role !== 'CAISSIER') {
      return res.status(400).json({ message: 'Cet utilisateur n\'est pas un employé' });
    }

    // Récupérer les modules disponibles pour comparaison
    const availableModules = [
      'products', 'orders', 'reports', 'promotions',
      'timeslots', 'suppliers', 'categories', 'customers',
      'inventory', 'settings', 'employees'
    ];

    // Upsert chaque permission
    for (const module of availableModules) {
      const permData = permissions[module] || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false
      };

      await prisma.employeePermission.upsert({
        where: { userId_module: { userId, module } },
        update: {
          canView: permData.canView,
          canCreate: permData.canCreate,
          canEdit: permData.canEdit,
          canDelete: permData.canDelete
        },
        create: {
          userId,
          module,
          canView: permData.canView,
          canCreate: permData.canCreate,
          canEdit: permData.canEdit,
          canDelete: permData.canDelete
        }
      });
    }

    // Récupérer les permissions mises à jour
    const updatedPermissions = await prisma.employeePermission.findMany({
      where: { userId },
      orderBy: { module: 'asc' }
    });

    const permissionsMap = {};
    updatedPermissions.forEach(p => {
      permissionsMap[p.module] = {
        canView: p.canView,
        canCreate: p.canCreate,
        canEdit: p.canEdit,
        canDelete: p.canDelete
      };
    });

    res.json({
      message: 'Permissions mises à jour',
      permissions: permissionsMap
    });
  } catch (error) {
    console.error('Update employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// DELETE /admin/employees/:userId/permissions - Supprimer toutes les permissions d'un employé (réinitialiser)
router.delete('/:userId', verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    await prisma.employeePermission.deleteMany({
      where: { userId }
    });

    res.json({ message: 'Permissions réinitialisées' });
  } catch (error) {
    console.error('Delete employee permissions error:', error);
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});

// GET /admin/employees/permissions/modules - Lister tous les modules disponibles
router.get('/modules', (req, res) => {
  const modules = [
    {
      key: 'products',
      label: 'Produits',
      description: 'Gestion du catalogue produits (ajout, modification, suppression, visualisation)'
    },
    {
      key: 'orders',
      label: 'Commandes',
      description: 'Gestion des commandes clients (consultation, modification de statut)'
    },
    {
      key: 'reports',
      label: 'Rapports',
      description: 'Accès aux rapports statistiques et analyses'
    },
    {
      key: 'promotions',
      label: 'Promotions',
      description: 'Gestion des promotions et codes promo'
    },
    {
      key: 'timeslots',
      label: 'Créneaux horaires',
      description: 'Gestion des créneaux de retrait et calendrier'
    },
    {
      key: 'suppliers',
      label: 'Fournisseurs',
      description: 'Gestion des fournisseurs et commandes fournisseurs'
    },
    {
      key: 'categories',
      label: 'Catégories',
      description: 'Gestion des catégories et sous-catégories'
    },
    {
      key: 'customers',
      label: 'Clients',
      description: 'Gestion des comptes clients'
    },
    {
      key: 'inventory',
      label: 'Inventaire',
      description: 'Gestion des stocks et mouvements'
    },
    {
      key: 'settings',
      label: 'Paramètres',
      description: 'Configuration générale du système'
    },
    {
      key: 'employees',
      label: 'Employés',
      description: 'Gestion des comptes employés et permissions'
    }
  ];

  res.json(modules);
});

export default router;
