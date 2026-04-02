import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// backend/prisma/seed.js
// Modifiez la création de l'admin

async function createAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@parapharmacie.ma';
  
  // Vérifier si un admin existe déjà avec le bon rôle
  const existingAdmin = await prisma.user.findFirst({
    where: { 
      role: 'ADMIN'
    }
  });
  
  if (existingAdmin) {
    console.log('⚠️ Un administrateur existe déjà:', existingAdmin.email);
    return;
  }
  
  // Supprimer d'éventuels comptes client avec le même email
  await prisma.user.deleteMany({
    where: { 
      email: adminEmail,
      role: 'CLIENT'
    }
  });
  
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
  console.log('✅ Admin créé avec succès:', admin.email);
}
createAdmin();
