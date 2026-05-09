import { config } from 'dotenv';
import { execSync } from 'child_process';

export default async function globalSetup() {
  config({ path: '.env.test' });
  process.env.NODE_ENV = 'test';

  // Créer et migrer la base de test
  try {
    execSync('npx prisma db push --force-reset', {
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      stdio: 'pipe'
    });
    console.log('✅ Base de test initialisée');
  } catch (e) {
    console.error('❌ Erreur init DB test:', e.message);
  }
}
