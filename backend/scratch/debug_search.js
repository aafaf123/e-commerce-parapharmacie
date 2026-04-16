const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({ select: { name: true } });
  const brands = await prisma.brand.findMany({ select: { name: true }, where: { active: true } });
  const brandsFromProducts = await prisma.product.findMany({ select: { brand: true }, distinct: ['brand'] });
  
  console.log('Categories:', categories.map(c => c.name));
  console.log('Brands from Brand table:', brands.map(b => b.name));
  console.log('Brands from Products:', brandsFromProducts.map(p => p.brand).filter(Boolean));
}

main().catch(console.error).finally(() => prisma.$disconnect());
