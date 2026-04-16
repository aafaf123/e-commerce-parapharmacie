import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting price migration...');
  
  const products = await prisma.product.findMany();
  console.log(`📦 Found ${products.length} products to migrate.`);
  
  for (const product of products) {
    const taxRate = 20; // Default 20%
    const priceTTC = product.price || 0;
    const priceHT = priceTTC / (1 + taxRate / 100);
    
    const oldPriceTTC = product.oldPrice || null;
    const oldPriceHT = oldPriceTTC ? oldPriceTTC / (1 + taxRate / 100) : null;
    
    await prisma.product.update({
      where: { id: product.id },
      data: {
        priceHT: parseFloat(priceHT.toFixed(2)),
        priceTTC: parseFloat(priceTTC.toFixed(2)),
        taxRate: taxRate,
        oldPriceHT: oldPriceHT ? parseFloat(oldPriceHT.toFixed(2)) : null,
        price: parseFloat(priceTTC.toFixed(2)),
        oldPrice: oldPriceTTC ? parseFloat(oldPriceTTC.toFixed(2)) : null
      }
    });
    
    console.log(`✅ Migrated: ${product.name} (${priceTTC} DH TTC)`);
  }
  
  console.log('🎉 Migration completed successfully!');
}

migrate()
  .catch(e => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
