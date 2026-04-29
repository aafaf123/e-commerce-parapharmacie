import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function startStockNotifier(io) {
  console.log('🔔 Stock Notifier démarré');

  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🔍 Check stock critique...');

      const lowStockProducts = await prisma.product.findMany({
        where: { stock: { lt: 5 }, active: true },
        select: { id: true, name: true, stock: true, stockAlert: true, brand: true },
        take: 10
      });

      if (lowStockProducts.length === 0) {
        console.log('✅ Aucun stock critique');
        return;
      }

      console.log(`⚠️ ${lowStockProducts.length} produits en stock critique`);

      // Notification WebSocket admins uniquement
      io.to('admin_room').emit('admin_stock_alert_batch', {
        products: lowStockProducts,
        count: lowStockProducts.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ StockNotifier error:', error);
    }
  });
}
