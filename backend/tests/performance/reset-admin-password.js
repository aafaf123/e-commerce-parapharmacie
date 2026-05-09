import prisma from '../../src/prismaClient.js';
import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash('Admin1234!', 10);
await prisma.admin.update({
  where: { email: 'admin@parapharmacie.ma' },
  data: { password: hash }
});
console.log('✅ Mot de passe admin réinitialisé : Admin1234!');
await prisma.$disconnect();
