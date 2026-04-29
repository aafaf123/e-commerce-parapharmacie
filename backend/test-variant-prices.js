import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testVariantPrices() {
  console.log('🧪 Testing variant price display...');

  // Get a product with variants that have custom prices
  const product = await prisma.product.findFirst({
    where: {
      productVariants: {
        some: {
          OR: [
            { priceHT: { not: null } },
            { priceTTC: { not: null } }
          ]
        }
      }
    },
    include: {
      productVariants: {
        where: {
          OR: [
            { priceHT: { not: null } },
            { priceTTC: { not: null } }
          ]
        }
      }
    }
  });

  if (!product) {
    console.log('❌ No product with variants having custom prices found');
    return;
  }

  console.log(`📦 Product: ${product.name}`);
  console.log(`📊 Product prices: HT=${product.priceHT}, TTC=${product.priceTTC || product.price}`);

  product.productVariants.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.value}: HT=${v.priceHT}, TTC=${v.priceTTC}, barcode=${v.barcode}, expiry=${v.expiryDate}`);
  });

  await prisma.$disconnect();
}

testVariantPrices().catch(console.error);