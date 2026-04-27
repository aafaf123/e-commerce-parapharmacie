import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testVariantUpdate() {
  console.log('🧪 Testing variant data update...');

  // Get a product with variants
  const product = await prisma.product.findFirst({
    where: {
      productVariants: {
        some: {}
      }
    },
    include: {
      productVariants: true
    }
  });

  if (!product) {
    console.log('❌ No product with variants found');
    return;
  }

  console.log(`📦 Testing with product: ${product.name}`);
  console.log(`📊 Current variants: ${product.productVariants.length}`);

  product.productVariants.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.value}: stock=${v.stock}, priceHT=${v.priceHT}, priceTTC=${v.priceTTC}, barcode=${v.barcode}, expiry=${v.expiryDate}`);
  });

  await prisma.$disconnect();
}

testVariantUpdate().catch(console.error);