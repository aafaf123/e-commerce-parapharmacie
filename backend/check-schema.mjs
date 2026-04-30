import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const auditCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='AuditLog' ORDER BY ordinal_position`;
const empCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='EmployeePermission' ORDER BY ordinal_position`;
const auditRows = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "AuditLog"`;
const empRows = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "EmployeePermission"`;

console.log('AuditLog cols:', auditCols.map(c=>c.column_name).join(', '));
console.log('AuditLog rows:', auditRows[0].count.toString());
console.log('EmployeePermission cols:', empCols.map(c=>c.column_name).join(', '));
console.log('EmployeePermission rows:', empRows[0].count.toString());

await prisma.$disconnect();
