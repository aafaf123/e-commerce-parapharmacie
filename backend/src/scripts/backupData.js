// Script de backup des données avant migration sécurisée
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function backupData() {
  console.log('🔄 Début du backup des données...')
  
  try {
    // Backup des utilisateurs
    const users = await prisma.user.findMany()
    console.log(`📊 ${users.length} utilisateurs trouvés`)
    
    // Backup des commandes
    const orders = await prisma.order.findMany({
      include: {
        items: true
      }
    })
    console.log(`📦 ${orders.length} commandes trouvées`)
    
    // Backup des favoris
    const favorites = await prisma.favorite.findMany()
    console.log(`❤️ ${favorites.length} favoris trouvés`)
    
    // Backup des permissions
    const permissions = await prisma.employeePermission.findMany()
    console.log(`🔐 ${permissions.length} permissions trouvées`)
    
    // Créer l'objet de backup
    const backupData = {
      timestamp: new Date().toISOString(),
      users,
      orders,
      favorites,
      permissions,
      stats: {
        totalUsers: users.length,
        clients: users.filter(u => u.role === 'CLIENT').length,
        employees: users.filter(u => u.role === 'EMPLOYE').length,
        admins: users.filter(u => u.role === 'ADMIN').length,
        totalOrders: orders.length,
        totalFavorites: favorites.length,
        totalPermissions: permissions.length
      }
    }
    
    // Sauvegarder dans un fichier JSON
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    fs.writeFileSync(filename, JSON.stringify(backupData, null, 2))
    
    console.log(`✅ Backup créé: ${filename}`)
    console.log('📊 Statistiques du backup:')
    console.log(`   👥 Clients: ${backupData.stats.clients}`)
    console.log(`   👷 Employés: ${backupData.stats.employees}`)
    console.log(`   👑 Admins: ${backupData.stats.admins}`)
    console.log(`   📦 Commandes: ${backupData.stats.totalOrders}`)
    console.log(`   ❤️ Favoris: ${backupData.stats.totalFavorites}`)
    console.log(`   🔐 Permissions: ${backupData.stats.totalPermissions}`)
    
    return {
      success: true,
      filename,
      stats: backupData.stats
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du backup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Exécuter le backup
if (import.meta.url === `file://${process.argv[1]}`) {
  backupData()
    .then((result) => {
      console.log('🎉 Backup terminé avec succès!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Échec du backup:', error)
      process.exit(1)
    })
}

export default backupData