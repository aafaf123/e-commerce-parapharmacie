import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updatePromotion() {
  try {
    // 1. Voir toutes les promotions existantes
    const allPromotions = await prisma.promotion.findMany()
    console.log('📋 Promotions existantes:', allPromotions.map(p => ({
      id: p.id,
      title: p.title,
      startDate: p.startDate,
      endDate: p.endDate,
      active: p.active
    })))
    
    if (allPromotions.length === 0) {
      console.log('❌ Aucune promotion trouvée')
      return
    }
    
    // 2. Mettre à jour la première promotion (ou utilisez un ID spécifique)
    const today = new Date('2026-03-30T00:00:00.000Z')
    
    const updated = await prisma.promotion.update({
      where: { id: allPromotions[0].id },
      data: {
        startDate: today,  // Change la date de début à aujourd'hui
        active: true
      }
    })
    
    console.log('✅ Promotion mise à jour:', {
      title: updated.title,
      startDate: updated.startDate,
      endDate: updated.endDate,
      active: updated.active
    })
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updatePromotion()