// backend/create-admin-direct.js
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Client } = pg;

async function createAdmin() {
  const client = new Client({
    connectionString: 'postgresql://postgres:hhhhf@localhost:5432/parapharmacie'
  });

  try {
    await client.connect();
    console.log('🔧 Connexion à la base de données...');

    // Vérifier si admin existe
    const checkResult = await client.query(
      'SELECT * FROM "User" WHERE email = $1',
      ['admin@parapharmacie.ma']
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Admin existe déjà:', checkResult.rows[0].email);
      console.log('   Rôle:', checkResult.rows[0].role);
      console.log('   Actif:', checkResult.rows[0].isActive);
      return;
    }

    // Créer l'admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const result = await client.query(`
      INSERT INTO "User" (
        email, password, "firstName", "lastName", phone, role, "isActive", "authProvider", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *
    `, [
      'admin@parapharmacie.ma',
      hashedPassword,
      'Admin',
      'System', 
      '+212600000000',
      'ADMIN',
      true,
      'LOCAL'
    ]);

    console.log('✅ Admin créé avec succès:');
    console.log('   Email: admin@parapharmacie.ma');
    console.log('   Mot de passe: admin123');
    console.log('   Rôle:', result.rows[0].role);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

createAdmin();