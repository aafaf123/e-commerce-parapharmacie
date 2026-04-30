// backend/create-admin-sql.js
import bcrypt from 'bcryptjs';

async function createAdminSQL() {
  try {
    console.log('🔧 Création de l\'admin...');
    
    // Générer le hash du mot de passe
    const hashedPassword = await bcrypt.hash('admin123', 10);
    console.log('✅ Hash généré:', hashedPassword.substring(0, 20) + '...');
    
    console.log('\n📋 SQL à exécuter dans votre base PostgreSQL:');
    console.log('----------------------------------------');
    
    const sql = `
INSERT INTO "User" (
  id, email, password, "firstName", "lastName", phone, role, "isActive", "authProvider", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(),
  'admin@parapharmacie.ma',
  '${hashedPassword}',
  'Admin',
  'System',
  '+212600000000',
  'ADMIN',
  true,
  'LOCAL',
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  "isActive" = EXCLUDED."isActive";
`;
    
    console.log(sql);
    console.log('----------------------------------------');
    console.log('\n✅ Credentials admin:');
    console.log('   Email: admin@parapharmacie.ma');
    console.log('   Mot de passe: admin123');
    console.log('   Rôle: ADMIN');
    
    console.log('\n🚀 Après avoir exécuté ce SQL, testez la connexion sur:');
    console.log('   http://localhost:5000/admin/login');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

createAdminSQL();