// backend/create-admin.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Supprimer l'admin s'il existe
  await prisma.user.deleteMany({ where: { email: 'admin@parapharmacie.ma' } });
  console.log('🗑️ Ancien admin supprimé');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);
  console.log('🔐 Hash généré:', hashedPassword);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@parapharmacie.ma',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'ParaClick',
      phone: '0600000000',
      address: 'Pharmacie ParaClick, Casablanca',
      role: 'ADMIN',
      isActive: true
    }
  });
  
  console.log('\n✅ ADMIN CRÉÉ AVEC SUCCÈS !');
  console.log('   Email:', admin.email);
  console.log('   Mot de passe: admin123');
  console.log('   Rôle:', admin.role);
  console.log('   ID:', admin.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());