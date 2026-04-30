// Script de backup simplifié
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

console.log('🔄 Début du backup...')

try {
  // Compter les utilisateurs
  const userCount = await prisma.user.count()
  console.log(`👥 ${userCount} utilisateurs dans la base`)
  
  // Récupérer tous les utilisateurs
  const users = await prisma.user.findMany()
  
  // Statistiques par rôle
  const stats = {
    clients: users.filter(u => u.role === 'CLIENT').length,
    employees: users.filter(u => u.role === 'EMPLOYE').length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    total: users.length
  }
  
  console.log('📊 Répartition:')
  console.log(`   👥 Clients: ${stats.clients}`)
  console.log(`   👷 Employés: ${stats.employees}`)
  console.log(`   👑 Admins: ${stats.admins}`)
  
  // Créer le backup
  const backupData = {
    timestamp: new Date().toISOString(),
    users,
    stats
  }
  
  const filename = 'backup_users.json'
  fs.writeFileSync(filename, JSON.stringify(backupData, null, 2))
  
  console.log(`✅ Backup créé: ${filename}`)
  console.log('🎉 Backup terminé avec succès!')
  
} catch (error) {
  console.error('❌ Erreur:', error.message)
} finally {
  await prisma.$disconnect()
}