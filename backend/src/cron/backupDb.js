import cron from 'node-cron';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const MAX_BACKUPS = 7;

async function createPrismaBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
  
  try {
    const data = {
      version: 'parapharmacie-backup-v1',
      timestamp: new Date().toISOString(),
      users: await prisma.user.findMany(),
      categories: await prisma.category.findMany(),
      products: await prisma.product.findMany(),
      orders: await prisma.order.findMany(),
      promotions: await prisma.promotion.findMany(),
      promoCodes: await prisma.promoCode.findMany(),
      reviews: await prisma.review.findMany(),
      timeSlots: await prisma.timeSlot.findMany(),
      suppliers: await prisma.supplier.findMany(),
      stocks: await prisma.stock.findMany(),
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    console.log(`Backup created: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.error('Backup error:', error);
    throw error;
  }
}

function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      fs.unlinkSync(file.path);
      console.log(`Deleted old backup: ${file.name}`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

export function startBackupCron() {
  // Daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Starting daily database backup...');
    try {
      await createPrismaBackup();
      cleanupOldBackups();
      console.log('Daily backup completed successfully');
    } catch (error) {
      console.error('Backup cron failed:', error);
    }
  });

  console.log('Backup cron scheduled: daily at 2:00 AM');
}

export { createPrismaBackup, cleanupOldBackups };