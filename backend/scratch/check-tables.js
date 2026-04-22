import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%PurchaseOrder%' OR table_name LIKE '%SupplierDiscount%' OR table_name LIKE '%SupplierPurchase%')
    `;
    console.log('Tables found:', JSON.stringify(tables, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();