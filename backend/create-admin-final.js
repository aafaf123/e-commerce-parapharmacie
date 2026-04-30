// backend/create-admin-final.js
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

async function createAdmin() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'parapharmacie',
    user: 'postgres',
    password: 'hhhhf'
  });

  try {
    await client.connect();
    console.log('🔧 Connexion à PostgreSQL réussie');

    // Vérifier si admin existe
    const checkResult = await client.query(
      'SELECT * FROM "Admin" WHERE email = $1',
      ['admin@parapharmacie.ma']
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Admin existe déjà:', checkResult.rows[0].email);
      console.log('   Actif:', checkResult.rows[0].isActive);
      return;
    }

    // Créer l'admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const result = await client.query(`
      INSERT INTO "Admin" (
        email, password, "firstName", "lastName", phone, "isActive", "isSuperAdmin", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `, [
      'admin@parapharmacie.ma',
      hashedPassword,
      'Admin',
      'System', 
      '+212600000000',
      true,
      true
    ]);

    console.log('✅ Admin créé avec succès:');
    console.log('   Email: admin@parapharmacie.ma');
    console.log('   Mot de passe: admin123');
    console.log('   Super Admin:', result.rows[0].isSuperAdmin);
    console.log('   ID:', result.rows[0].id);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

createAdmin();