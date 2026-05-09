import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

export function startStockNotifier(io) {
  logger.info('Stock Notifier démarré');

  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.debug('Check stock critique...');

      const lowStockProducts = await prisma.product.findMany({
        where: { stock: { lt: 5 }, active: true },
        select: { id: true, name: true, stock: true, stockAlert: true, brand: true },
        take: 10
      });

      if (lowStockProducts.length === 0) {
        logger.debug('Aucun stock critique');
        return;
      }

      logger.warn(`${lowStockProducts.length} produits en stock critique`, {
        products: lowStockProducts.map(p => ({ name: p.name, stock: p.stock }))
      });

      io.to('admin_room').emit('admin_stock_alert_batch', {
        products: lowStockProducts,
        count: lowStockProducts.length,
        timestamp: new Date().toISOString()
      });

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });

      const admins = await prisma.admin.findMany({
        where: { isActive: true },
        select: { email: true, firstName: true }
      });

      for (const admin of admins) {
        if (!admin.email) continue;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: admin.email,
          subject: `${lowStockProducts.length} produits en stock critique`,
          html: `<h2>Alertes Stock Critique</h2><ul>${lowStockProducts.map(p => `<li>${p.name} (${p.brand}) : ${p.stock}/${p.stockAlert}</li>`).join('')}</ul>`
        });
        logger.info(`Alerte stock envoyée à ${admin.email}`);
      }

    } catch (error) {
      logger.error('StockNotifier error', { message: error.message, stack: error.stack });
    }
  });
}
