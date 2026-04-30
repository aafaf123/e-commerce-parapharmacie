import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

export function startStockNotifier(io) {
  console.log('🔔 Stock Notifier démarré');

  // Vérification toutes les 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🔍 Check stock critique...');
      
      // Produits en stock critique
      const lowStockProducts = await prisma.product.findMany({
        where: {
          stock: { lt: 5 }, // Seuil critique
          active: true
        },
        select: {
          id: true,
          name: true,
          stock: true,
          stockAlert: true,
          brand: true
        },
        take: 10
      });

      if (lowStockProducts.length === 0) {
        console.log('✅ Aucun stock critique');
        return;
      }

      console.log(`⚠️ ${lowStockProducts.length} produits en stock critique`);

      // Notification WebSocket admins
      io.to('admin_room').emit('admin_stock_alert_batch', {
        products: lowStockProducts,
        count: lowStockProducts.length,
        timestamp: new Date().toISOString()
      });

      // Email admins (si configuré)
      // 🔧 CORRECTION : createTransporter → createTransport
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true, firstName: true }
      });

      for (const admin of admins) {
        if (!admin.email) continue;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: admin.email,
          subject: `🚨 ${lowStockProducts.length} produits en stock critique`,
          html: `
            <h2>Alertes Stock Critique</h2>
            <ul>
              ${lowStockProducts.map(p => `<li>${p.name} (${p.brand}) : ${p.stock}/${p.stockAlert}</li>`).join('')}
            </ul>
            <p>Vérifiez le dashboard admin.</p>
          `
        });
      }

    } catch (error) {
      console.error('❌ StockNotifier error:', error);
    }
  });
}