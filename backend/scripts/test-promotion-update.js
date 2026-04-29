// Test script to update a promotion with automatic Arabic translation
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const prisma = new PrismaClient()

// Translation utility function (same as in admin.js)
const translateToArabic = async (text) => {
  if (!text || typeof text !== 'string' || text.trim().length < 2) return text;

  // Manual overrides for problematic translations
  const manualOverrides = {
    'Complémentaires': 'مكملات',
    'complémentaires': 'مكملات',
    'Hydrataion': 'الترطيب',
    'hydrataion': 'الترطيب'
  };

  if (manualOverrides[text.trim()]) {
    return manualOverrides[text.trim()];
  }

  try {
    const response = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=fr|ar');
    const data = await response.json();
    let result = data?.responseData?.translatedText;
    if (result && result !== text) {
      // Clean XML/HTML tags
      result = result.replace(/<[^>]+>/g, '').trim();
      if (result) return result;
    }
  } catch (error) {
    console.error('Translation error:', error);
  }
  return text;
};

async function testPromotionUpdate() {
  console.log('🧪 Testing promotion update with automatic Arabic translation...')

  try {
    // First, create a test promotion
    const createPromo = await prisma.promotion.create({
      data: {
        title: 'Test Product',
        description: 'Test description',
        discountType: 'percentage',
        discountValue: 10,
        titleAr: 'منتج اختبار',
        descriptionAr: 'وصف اختبار',
        active: true,
        order: 0,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      }
    })

    console.log('✅ Test promotion created with ID:', createPromo.id)
    console.log(`Original Title (FR): ${createPromo.title}`)
    console.log(`Original Title (AR): ${createPromo.titleAr}`)

    // Now update it with new French text
    const newTitle = 'Hydrataion Premium'
    const newDescription = 'Produit hydratant premium de luxe'

    console.log('\nUpdating promotion with new French text...')
    console.log(`New Title (FR): ${newTitle}`)
    console.log(`New Description (FR): ${newDescription}`)

    // Auto-translate new fields
    const [titleAr, descriptionAr] = await Promise.all([
      translateToArabic(newTitle),
      translateToArabic(newDescription)
    ])

    console.log(`Auto-translated Title (AR): ${titleAr}`)
    console.log(`Auto-translated Description (AR): ${descriptionAr}`)

    // Update the promotion
    const updatedPromo = await prisma.promotion.update({
      where: { id: createPromo.id },
      data: {
        title: newTitle,
        description: newDescription,
        titleAr,
        descriptionAr
      }
    })

    console.log('\n✅ Promotion updated successfully!')
    console.log(`Updated Title (FR): ${updatedPromo.title}`)
    console.log(`Updated Title (AR): ${updatedPromo.titleAr}`)
    console.log(`Updated Description (FR): ${updatedPromo.description}`)
    console.log(`Updated Description (AR): ${updatedPromo.descriptionAr}`)

    // Clean up - delete the test promotion
    await prisma.promotion.delete({ where: { id: createPromo.id } })
    console.log('\n🧹 Test promotion cleaned up')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPromotionUpdate()