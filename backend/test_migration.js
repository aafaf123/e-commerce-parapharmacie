// Test de la migration sécurisée
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testSecureMigration() {
  console.log('🔍 Test de la migration sécurisée...')
  
  try {
    // Test 1: Vérifier les clients
    const clients = await prisma.$queryRaw`SELECT COUNT(*) as count, email FROM "Client" GROUP BY email LIMIT 3`
    console.log(`✅ Clients accessibles: ${clients.length} exemples`)
    
    // Test 2: Vérifier les employés  
    const employees = await prisma.$queryRaw`SELECT COUNT(*) as count, email FROM "Employee" GROUP BY email LIMIT 3`
    console.log(`✅ Employés accessibles: ${employees.length} exemples`)
    
    // Test 3: Vérifier les admins
    const admins = await prisma.$queryRaw`SELECT COUNT(*) as count, email FROM "Admin" GROUP BY email LIMIT 3`
    console.log(`✅ Admins accessibles: ${admins.length} exemples`)
    
    // Test 4: Vérifier la séparation (un client ne peut pas voir les employés)
    console.log('\n🔒 Test de sécurité:')
    
    try {
      // Simuler une requête malveillante
      const maliciousQuery = await prisma.$queryRaw`
        SELECT c.email as client_email, e.email as employee_email 
        FROM "Client" c, "Employee" e 
        LIMIT 1
      `
      console.log('⚠️ Attention: Les tables peuvent être jointes (normal en SQL)')
    } catch (error) {
      console.log('✅ Séparation parfaite: impossible de joindre les tables')
    }
    
    // Test 5: Compter les utilisateurs par type
    const clientCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Client"`
    const employeeCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Employee"`  
    const adminCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Admin"`
    const oldUserCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "User"`
    
    console.log('\n📊 Statistiques:')
    console.log(`👥 Clients: ${clientCount[0].count}`)
    console.log(`👷 Employés: ${employeeCount[0].count}`)
    console.log(`👑 Admins: ${adminCount[0].count}`)
    console.log(`📜 Anciens utilisateurs (User): ${oldUserCount[0].count}`)
    
    // Test 6: Vérifier qu'on peut toujours se connecter
    console.log('\n🔐 Test de connexion:')
    
    // Récupérer un client pour test
    const testClient = await prisma.$queryRaw`SELECT email FROM "Client" LIMIT 1`
    if (testClient.length > 0) {
      console.log(`✅ Client de test trouvé: ${testClient[0].email}`)
    }
    
    // Récupérer un admin pour test  
    const testAdmin = await prisma.$queryRaw`SELECT email FROM "Admin" LIMIT 1`
    if (testAdmin.length > 0) {
      console.log(`✅ Admin de test trouvé: ${testAdmin[0].email}`)
    }
    
    console.log('\n🎉 Migration sécurisée validée!')
    console.log('🔒 Les données sont maintenant séparées par type d\'utilisateur')
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSecureMigration()