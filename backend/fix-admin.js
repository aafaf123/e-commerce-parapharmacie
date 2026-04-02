// backend/fix-admin.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@parapharmacie.ma';
  
  // Supprimer TOUS les comptes avec cet email (client ou admin)
  await prisma.user.deleteMany({ where: { email: adminEmail } });
  
  // Supprimer tous les comptes client nommés Admin ParaClick
  await prisma.user.deleteMany({
    where: {
      firstName: 'Admin',
      lastName: 'ParaClick',
      role: 'CLIENT'
    }
  });
  
  // Vérifier s'il reste d'autres admins
  const existingAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' }
  });
  
  // Supprimer les autres admins
  for (const admin of existingAdmins) {
    await prisma.user.delete({ where: { id: admin.id } });
    console.log(`🗑️ Ancien admin supprimé: ${admin.email}`);
  }
  
  // Créer le nouvel admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'ParaClick',
      phone: '0600000000',
      address: 'Pharmacie ParaClick, Casablanca',
      role: 'ADMIN',
      isActive: true
    }
  });
  
  console.log('✅ Admin créé avec succès:');
  console.log('   Email:', admin.email);
  console.log('   Mot de passe: admin123');
  console.log('   Rôle:', admin.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());