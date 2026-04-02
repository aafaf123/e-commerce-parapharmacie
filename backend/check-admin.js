// backend/check-admin.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Chercher l'admin
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@parapharmacie.ma' }
  });
  
  if (admin) {
    console.log('✅ ADMIN TROUVÉ:');
    console.log('   Email:', admin.email);
    console.log('   Rôle:', admin.role);
    console.log('   Actif:', admin.isActive);
    console.log('   Hash mot de passe:', admin.password);
  } else {
    console.log('❌ ADMIN NON TROUVÉ');
  }
  
  // Afficher tous les utilisateurs
  const allUsers = await prisma.user.findMany();
  console.log('\n📋 Tous les utilisateurs:');
  allUsers.forEach(u => {
    console.log(`   - ${u.email} (${u.role})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());