// backend/check-admin.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Chercher l'admin
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@parapharmacie.ma' }
    });
    
    if (admin) {
      console.log('✅ ADMIN TROUVÉ:');
      console.log('   Email:', admin.email);
      console.log('   Rôle:', admin.role);
      console.log('   Actif:', admin.isActive);
      console.log('   Hash mot de passe:', admin.password ? 'Présent' : 'Absent');
    } else {
      console.log('❌ ADMIN NON TROUVÉ');
    }
    
    // Afficher tous les utilisateurs avec rôle ADMIN ou EMPLOYE
    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'EMPLOYE']
        }
      }
    });
    console.log('\n📋 Utilisateurs admin/employés:');
    adminUsers.forEach(u => {
      console.log(`   - ${u.email} (${u.role}) - Actif: ${u.isActive}`);
    });
  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());