// backend/create-admin-simple.js
import bcrypt from 'bcryptjs';
import prisma from './src/prismaClient.js';

async function createAdmin() {
  try {
    console.log('🔧 Création de l\'admin...');
    
    // Vérifier si admin existe déjà
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@parapharmacie.ma' }
    });
    
    if (existingAdmin) {
      console.log('✅ Admin existe déjà:', existingAdmin.email);
      console.log('   Rôle:', existingAdmin.role);
      console.log('   Actif:', existingAdmin.isActive);
      return;
    }
    
    // Créer l'admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@parapharmacie.ma',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'System',
        phone: '+212600000000',
        role: 'ADMIN',
        isActive: true,
        authProvider: 'LOCAL'
      }
    });
    
    console.log('✅ Admin créé avec succès:');
    console.log('   Email: admin@parapharmacie.ma');
    console.log('   Mot de passe: admin123');
    console.log('   Rôle:', admin.role);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();