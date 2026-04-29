// Script to update existing promotions with Arabic translations
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

async function updatePromotions() {
  console.log('🔄 Updating promotions with Arabic translations...')
  
  try {
    // Get all existing promotions
    const promotions = await prisma.promotion.findMany()
    console.log(`Found ${promotions.length} promotions`)
    
    for (const promo of promotions) {
      let updateData = {}
      
      // OFFRE FLASH -20%
      if (promo.title.includes('OFFRE FLASH')) {
        updateData = {
          titleAr: 'عرض فلاش -20%',
          subtitleAr: 'على جميع منتجات البارافارماسي',
          descriptionAr: 'استفد من خصم 20% على جميع المنتجات',
          featuresAr: ['توصيل مجاني', 'دفع آمن', 'سحب من الصيدلية'],
          ctaTextAr: 'استفد الآن'
        }
      }
      // BEAUTÉ EXPRESS
      else if (promo.title.includes('BEAUTÉ') || promo.title.includes('BEAUTE')) {
        updateData = {
          titleAr: 'بيوتي إكسبرس',
          subtitleAr: 'حتى 30% على العناية بالوجه',
          descriptionAr: 'اكتشفوا تشكيلة منتجات العناية بالوجه بأسعار مخفضة',
          featuresAr: ['منتجات فاخرة', 'نتائج مضمونة', 'عرض حصري'],
          ctaTextAr: 'أستفيد',
          productNameAr: 'العناية بالوجه'
        }
      }
      // NOUVEAUTÉS
      else if (promo.title.includes('NOUVEAUT') || promo.title.includes('وصل حديثاً')) {
        updateData = {
          titleAr: 'وصل حديثاً',
          subtitleAr: 'اكتشفوا أحدث الصيحات',
          descriptionAr: 'وصلت جديد الموسم',
          featuresAr: ['جديد حصري', 'أول وصول', 'كميات محدودة'],
          ctaTextAr: 'تصفح الجديد'
        }
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.promotion.update({
          where: { id: promo.id },
          data: updateData
        })
        console.log(`✅ Updated promotion: ${promo.title}`)
      }
    }
    
    console.log('🎉 All promotions updated with Arabic translations!')
  } catch (error) {
    console.error('❌ Error updating promotions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updatePromotions()