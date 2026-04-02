// backend/fix-admin-password.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@parapharmacie.ma';
  
  // Générer le bon hash pour admin123
  const hashedPassword = await bcrypt.hash('admin123', 10);
  console.log('🔐 Nouveau hash pour admin123:', hashedPassword);
  
  // Mettre à jour l'admin
  const admin = await prisma.user.update({
    where: { email: adminEmail },
    data: { password: hashedPassword }
  });
  
  console.log('✅ Mot de passe mis à jour avec succès !');
  console.log('   Email:', admin.email);
  console.log('   Nouveau mot de passe: admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());