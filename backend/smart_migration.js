// Migration intelligente avec gestion des conflits
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function smartMigration() {
  console.log('🔄 Début de la migration intelligente...')
  
  try {
    // 1. Créer les nouvelles tables manuellement
    console.log('📋 Création des nouvelles tables...')
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Client" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "phone" TEXT,
        "address" TEXT,
        "whatsapp" TEXT,
        "profileImage" TEXT,
        "notificationEmail" BOOLEAN NOT NULL DEFAULT true,
        "notificationSMS" BOOLEAN NOT NULL DEFAULT false,
        "notificationWhatsApp" BOOLEAN NOT NULL DEFAULT false,
        "notificationPush" BOOLEAN NOT NULL DEFAULT true,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "resetToken" TEXT,
        "resetTokenExpiry" TIMESTAMP,
        "deleteCode" TEXT,
        "deleteCodeExpiry" TIMESTAMP,
        "authProvider" TEXT NOT NULL DEFAULT 'local',
        "cart" TEXT DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Employee" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "phone" TEXT,
        "employeeId" TEXT UNIQUE,
        "department" TEXT,
        "position" TEXT,
        "salary" DECIMAL(10,2),
        "hireDate" TIMESTAMP,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "resetToken" TEXT,
        "resetTokenExpiry" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Admin" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "phone" TEXT,
        "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
        "lastLoginAt" TIMESTAMP,
        "loginAttempts" INTEGER DEFAULT 0,
        "lockedUntil" TIMESTAMP,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "resetToken" TEXT,
        "resetTokenExpiry" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `
    
    console.log('✅ Tables créées')
    
    // 2. Migrer les données
    console.log('👥 Migration des utilisateurs...')
    
    // Clients
    await prisma.$executeRaw`
      INSERT INTO "Client" (
        "id", "email", "password", "firstName", "lastName", "phone", "address",
        "whatsapp", "profileImage", "notificationEmail", "notificationSMS",
        "notificationWhatsApp", "notificationPush", "isActive", "resetToken",
        "resetTokenExpiry", "deleteCode", "deleteCodeExpiry", "authProvider",
        "cart", "createdAt", "updatedAt"
      )
      SELECT 
        "id", "email", "password", "firstName", "lastName", "phone", "address",
        "whatsapp", "profileImage", "notificationEmail", "notificationSMS",
        "notificationWhatsApp", "notificationPush", "isActive", "resetToken",
        "resetTokenExpiry", "deleteCode", "deleteCodeExpiry", 
        COALESCE("authProvider", 'local'), 
        COALESCE("cart", '[]'),
        "createdAt", "updatedAt"
      FROM "User" 
      WHERE "role" = 'CLIENT'
      ON CONFLICT ("id") DO NOTHING;
    `
    
    // Employés
    await prisma.$executeRaw`
      INSERT INTO "Employee" (
        "id", "email", "password", "firstName", "lastName", "phone",
        "employeeId", "department", "position", "salary", "hireDate",
        "isActive", "resetToken", "resetTokenExpiry", "createdAt", "updatedAt"
      )
      SELECT 
        "id", "email", "password", "firstName", "lastName", "phone",
        CONCAT('EMP', RIGHT("id", 6)),
        CASE 
          WHEN "role" = 'PREPARATEUR' THEN 'Préparation'
          WHEN "role" = 'CAISSIER' THEN 'Caisse'
          ELSE 'Général'
        END,
        "role",
        "salary",
        "createdAt",
        "isActive", "resetToken", "resetTokenExpiry", "createdAt", "updatedAt"
      FROM "User" 
      WHERE "role" IN ('EMPLOYE', 'PREPARATEUR', 'CAISSIER')
      ON CONFLICT ("id") DO NOTHING;
    `
    
    // Admins
    await prisma.$executeRaw`
      INSERT INTO "Admin" (
        "id", "email", "password", "firstName", "lastName", "phone",
        "isSuperAdmin", "isActive", "resetToken", "resetTokenExpiry", 
        "createdAt", "updatedAt"
      )
      SELECT 
        "id", "email", "password", "firstName", "lastName", "phone",
        CASE WHEN "email" LIKE '%super%' OR "email" LIKE '%root%' THEN true ELSE false END,
        "isActive", "resetToken", "resetTokenExpiry", "createdAt", "updatedAt"
      FROM "User" 
      WHERE "role" = 'ADMIN'
      ON CONFLICT ("id") DO NOTHING;
    `
    
    // 3. Vérifier les résultats
    const clientCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Client"`
    const employeeCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Employee"`
    const adminCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Admin"`
    
    console.log('✅ Migration terminée!')
    console.log(`👥 Clients migrés: ${clientCount[0].count}`)
    console.log(`👷 Employés migrés: ${employeeCount[0].count}`)
    console.log(`👑 Admins migrés: ${adminCount[0].count}`)
    
    return {
      success: true,
      clients: Number(clientCount[0].count),
      employees: Number(employeeCount[0].count),
      admins: Number(adminCount[0].count)
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    throw error
  }
}

// Exécuter la migration
smartMigration()
  .then((result) => {
    console.log('🎉 Migration réussie!', result)
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Échec de la migration:', error)
    process.exit(1)
  })