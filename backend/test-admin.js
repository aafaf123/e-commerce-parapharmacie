// backend/test-admin.js
import bcrypt from 'bcryptjs';

// Test simple sans Prisma
async function testAdmin() {
  try {
    console.log('🔧 Test de création admin...');
    
    // Simuler la création d'un hash
    const hashedPassword = await bcrypt.hash('admin123', 10);
    console.log('✅ Hash créé:', hashedPassword.substring(0, 20) + '...');
    
    console.log('\n📋 Credentials admin:');
    console.log('   Email: admin@parapharmacie.ma');
    console.log('   Mot de passe: admin123');
    console.log('   Rôle: ADMIN');
    
    console.log('\n🚀 Maintenant, testez la connexion admin sur http://localhost:5173/admin/login');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testAdmin();