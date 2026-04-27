// Migration script pour simplifier les statuts des bons de commande
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePurchaseOrderStatuses() {
  console.log('🔄 Migration des statuts des bons de commande...');
  
  try {
    // Mapping des anciens statuts vers les nouveaux
    const statusMapping = {
      'VALIDATION_ATTENTE': 'BROUILLON',
      'VALIDÉ': 'BROUILLON', 
      'REÇU_PARTIEL': 'ENVOYÉ',
      'REÇU_TOTAL': 'VALIDÉ',
      'ANNULÉ': 'BROUILLON', // Les annulés deviennent brouillons
      'PENDING': 'BROUILLON',
      'SENT': 'ENVOYÉ',
      'RECEIVED': 'VALIDÉ',
      'CANCELLED': 'BROUILLON'
    };

    // Compter les commandes à migrer
    const ordersToMigrate = await prisma.purchaseOrder.findMany({
      where: {
        status: {
          in: Object.keys(statusMapping)
        }
      }
    });

    console.log(`📊 ${ordersToMigrate.length} commandes à migrer`);

    // Migrer chaque statut
    for (const [oldStatus, newStatus] of Object.entries(statusMapping)) {
      const result = await prisma.purchaseOrder.updateMany({
        where: { status: oldStatus },
        data: { status: newStatus }
      });
      
      if (result.count > 0) {
        console.log(`✅ ${result.count} commandes migrées de "${oldStatus}" vers "${newStatus}"`);
      }
    }

    // Vérifier les résultats
    const finalCounts = await prisma.purchaseOrder.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    console.log('\n📈 Répartition finale des statuts :');
    finalCounts.forEach(({ status, _count }) => {
      console.log(`   ${status}: ${_count.status} commandes`);
    });

    console.log('\n✅ Migration terminée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la migration
migratePurchaseOrderStatuses()
  .catch((error) => {
    console.error('Migration échouée :', error);
    process.exit(1);
  });