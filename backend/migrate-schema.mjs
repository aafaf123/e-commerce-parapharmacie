import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('🔄 Migration AuditLog...');
// Ajouter les nouvelles colonnes avec valeurs par défaut
await prisma.$executeRaw`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userType" TEXT NOT NULL DEFAULT 'ADMIN'`;
await prisma.$executeRaw`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "employeeId" TEXT`;
await prisma.$executeRaw`ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "adminId" TEXT`;
console.log('✅ AuditLog migré');

console.log('🔄 Migration EmployeePermission...');
// Renommer userId → employeeId
await prisma.$executeRaw`ALTER TABLE "EmployeePermission" RENAME COLUMN "userId" TO "employeeId"`;
console.log('✅ EmployeePermission migré');

await prisma.$disconnect();
console.log('✅ Migration terminée !');
