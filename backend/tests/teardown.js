import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

export default async function globalTeardown() {
  try {
    // Nettoyer toutes les tables de test dans l'ordre
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "OrderItem", "Order", "StockMovement", "Review", "Favorite", "Client", "Employee", "Admin", "Product", "Category", "Brand", "Supplier", "PurchaseOrder", "Notification", "PromoCode", "Promotion" CASCADE');
    console.log('✅ Base de test nettoyée');
  } catch (e) {
    // Ignorer si tables n'existent pas
  } finally {
    await prisma.$disconnect();
  }
}
