import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkVariantsData() {
  console.log('🔍 Checking variants data in database...');

  const variants = await prisma.productVariant.findMany({
    select: {
      id: true,
      value: true,
      stock: true,
      priceHT: true,
      priceTTC: true,
      barcode: true,
      expiryDate: true,
      product: {
        select: {
          id: true,
          name: true
        }
      }
    },
    take: 20 // Check first 20 variants
  });

  console.log(`📊 Found ${variants.length} variants`);
  variants.forEach(v => {
    console.log(`- Product: ${v.product.name}`);
    console.log(`  Variant: ${v.value}`);
    console.log(`  Stock: ${v.stock} (type: ${typeof v.stock})`);
    console.log(`  Price HT: ${v.priceHT} (type: ${typeof v.priceHT})`);
    console.log(`  Price TTC: ${v.priceTTC} (type: ${typeof v.priceTTC})`);
    console.log(`  Barcode: ${v.barcode}`);
    console.log(`  Expiry: ${v.expiryDate}`);
    console.log('---');
  });

  await prisma.$disconnect();
}

checkVariantsData().catch(console.error);