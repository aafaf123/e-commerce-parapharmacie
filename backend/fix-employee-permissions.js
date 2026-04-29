import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEmployeePermissions() {
  try {
    console.log('🔧 Correction des permissions des employés...');

    // 1. Récupérer tous les employés
    const employees = await prisma.user.findMany({
      where: {
        role: {
          in: ['EMPLOYE', 'PREPARATEUR', 'CAISSIER']
        },
        isActive: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });

    console.log(`📋 ${employees.length} employé(s) trouvé(s)`);

    // 2. Modules disponibles
    const availableModules = [
      'products', 'orders', 'reports', 'promotions',
      'timeslots', 'suppliers', 'categories', 'customers',
      'inventory', 'settings', 'employees', 'reviews'
    ];

    // 3. Permissions par défaut selon le rôle
    const getDefaultPermissions = (role) => {
      switch (role) {
        case 'PREPARATEUR':
          return {
            products: { canView: true, canCreate: false, canEdit: false, canDelete: false },
            orders: { canView: true, canCreate: false, canEdit: true, canDelete: false },
            inventory: { canView: true, canCreate: false, canEdit: true, canDelete: false },
            categories: { canView: true, canCreate: false, canEdit: false, canDelete: false }
          };
        
        case 'CAISSIER':
          return {
            products: { canView: true, canCreate: false, canEdit: false, canDelete: false },
            orders: { canView: true, canCreate: true, canEdit: true, canDelete: false },
            customers: { canView: true, canCreate: false, canEdit: false, canDelete: false },
            reports: { canView: true, canCreate: false, canEdit: false, canDelete: false }
          };
        
        case 'EMPLOYE':
          return {
            products: { canView: true, canCreate: false, canEdit: false, canDelete: false },
            orders: { canView: true, canCreate: false, canEdit: false, canDelete: false },
            inventory: { canView: true, canCreate: false, canEdit: false, canDelete: false }
          };
        
        default:
          return {};
      }
    };

    // 4. Traiter chaque employé
    for (const employee of employees) {
      console.log(`👤 Traitement de ${employee.firstName} ${employee.lastName} (${employee.role})`);

      const defaultPermissions = getDefaultPermissions(employee.role);

      // Supprimer les anciennes permissions
      await prisma.employeePermission.deleteMany({
        where: { userId: employee.id }
      });

      // Créer les nouvelles permissions
      for (const module of availableModules) {
        const modulePermissions = defaultPermissions[module] || {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false
        };

        await prisma.employeePermission.create({
          data: {
            userId: employee.id,
            module: module,
            canView: modulePermissions.canView,
            canCreate: modulePermissions.canCreate,
            canEdit: modulePermissions.canEdit,
            canDelete: modulePermissions.canDelete
          }
        });
      }

      console.log(`  ✅ Permissions mises à jour pour ${employee.firstName} ${employee.lastName}`);
    }

    // 5. Afficher un résumé
    console.log('\n📊 Résumé des permissions par rôle:');
    
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      where: {
        role: {
          in: ['EMPLOYE', 'PREPARATEUR', 'CAISSIER']
        },
        isActive: true
      },
      _count: {
        id: true
      }
    });

    for (const stat of roleStats) {
      const permissions = await prisma.employeePermission.findMany({
        where: {
          user: {
            role: stat.role
          },
          canView: true
        },
        select: {
          module: true
        },
        distinct: ['module']
      });

      console.log(`  ${stat.role}: ${stat._count.id} employé(s) - Accès à ${permissions.length} module(s)`);
      console.log(`    Modules: ${permissions.map(p => p.module).join(', ')}`);
    }

    console.log('\n🎉 Correction des permissions terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de la correction des permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script si appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  fixEmployeePermissions();
}

export default fixEmployeePermissions;