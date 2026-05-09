import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../../backups');
const MAX_BACKUPS = 7;

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createPrismaBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

  try {
    const data = {
      version: 'parapharmacie-backup-v1',
      timestamp: new Date().toISOString(),
      clients:        await prisma.client.findMany({ omit: { password: true, resetToken: true, deleteCode: true } }),
      employees:      await prisma.employee.findMany({ omit: { password: true, resetToken: true } }),
      categories:     await prisma.category.findMany(),
      products:       await prisma.product.findMany(),
      orders:         await prisma.order.findMany(),
      promotions:     await prisma.promotion.findMany(),
      promoCodes:     await prisma.promoCode.findMany(),
      reviews:        await prisma.review.findMany(),
      timeSlotConfigs: await prisma.timeSlotConfig.findMany(),
      suppliers:      await prisma.supplier.findMany(),
      purchaseOrders: await prisma.purchaseOrder.findMany(),
    };

    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    logger.info(`Backup créé : ${backupFile}`);
    return backupFile;
  } catch (error) {
    logger.error('Backup error', { message: error.message, stack: error.stack });
    throw error;
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      logger.info(`Ancien backup supprimé : ${file.name}`);
    }
  } catch (error) {
    logger.error('Cleanup error', { message: error.message });
  }
}

export function startBackupCron() {
  cron.schedule('0 2 * * *', async () => {
    logger.info('Démarrage du backup quotidien...');
    try {
      await createPrismaBackup();
      cleanupOldBackups();
      logger.info('Backup quotidien terminé avec succès');
    } catch (error) {
      logger.error('Backup cron failed', { message: error.message });
    }
  });

  logger.info('Backup cron planifié : tous les jours à 2h00');
}

export { createPrismaBackup, cleanupOldBackups };
