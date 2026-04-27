import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkVariantMigration() {
  console.log('🔍 Checking for products with JSON variants that need migration...');

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      variants: true,
      _count: {
        select: {
          productVariants: true
        }
      }
    }
  });

  const productsWithJsonVariants = products.filter(p =>
    p.variants &&
    Array.isArray(p.variants) &&
    p.variants.length > 0 &&
    p._count.productVariants === 0
  );

  console.log(`📊 Found ${productsWithJsonVariants.length} products with JSON variants but no ProductVariant records`);

  if (productsWithJsonVariants.length > 0) {
    console.log('Products needing migration:');
    productsWithJsonVariants.forEach(p => {
      console.log(`- ${p.name} (${p.id}): ${p.variants.length} variants`);
    });
  }

  const productsWithBoth = products.filter(p =>
    p.variants &&
    Array.isArray(p.variants) &&
    p.variants.length > 0 &&
    p._count.productVariants > 0
  );

  console.log(`📊 Found ${productsWithBoth.length} products with both JSON and ProductVariant records`);

  await prisma.$disconnect();
}

checkVariantMigration().catch(console.error);