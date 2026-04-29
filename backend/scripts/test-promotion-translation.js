// Test script to create a promotion with automatic Arabic translation
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

async function testPromotionCreation() {
  console.log('🧪 Testing promotion creation with automatic Arabic translation...')

  try {
    const title = 'Hydrataion Intense'
    const description = 'Crème hydratante pour peau sèche'
    const subtitle = 'Pour une peau douce et hydratée'
    const productName = 'Crème Hydratante'
    const ctaText = 'Acheter maintenant'

    console.log('Original French text:')
    console.log(`Title: ${title}`)
    console.log(`Description: ${description}`)
    console.log(`Subtitle: ${subtitle}`)
    console.log(`Product Name: ${productName}`)
    console.log(`CTA Text: ${ctaText}`)

    // Auto-translate to Arabic
    const [titleAr, subtitleAr, descriptionAr, productNameAr, ctaTextAr] = await Promise.all([
      translateToArabic(title),
      translateToArabic(subtitle),
      translateToArabic(description),
      translateToArabic(productName),
      translateToArabic(ctaText)
    ]);

    console.log('\nTranslated Arabic text:')
    console.log(`Title: ${titleAr}`)
    console.log(`Description: ${descriptionAr}`)
    console.log(`Subtitle: ${subtitleAr}`)
    console.log(`Product Name: ${productNameAr}`)
    console.log(`CTA Text: ${ctaTextAr}`)

    // Create the promotion
    const promotion = await prisma.promotion.create({
      data: {
        title,
        description,
        subtitle,
        discountType: 'percentage',
        discountValue: 20,
        features: ['Hydratation intense', 'Pour peau sèche', 'Texture légère'],
        ctaText,
        productName,
        // Arabic fields
        titleAr,
        subtitleAr,
        descriptionAr,
        productNameAr,
        ctaTextAr,
        featuresAr: await Promise.all(['Hydratation intense', 'Pour peau sèche', 'Texture légère'].map(f => translateToArabic(f))),
        active: true,
        order: 0,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      }
    });

    console.log('\n✅ Promotion created successfully!')
    console.log(`ID: ${promotion.id}`)
    console.log(`Title (FR): ${promotion.title}`)
    console.log(`Title (AR): ${promotion.titleAr}`)

    // Clean up - delete the test promotion
    await prisma.promotion.delete({ where: { id: promotion.id } })
    console.log('🧹 Test promotion cleaned up')

  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPromotionCreation()