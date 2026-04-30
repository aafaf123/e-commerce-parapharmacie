import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Vérifier l'état actuel
const userCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='User' ORDER BY ordinal_position`;
const orderCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='Order' ORDER BY ordinal_position`;
const clientCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='Client' ORDER BY ordinal_position`;

console.log('User cols:', userCols.map(c=>c.column_name).join(', '));
console.log('Order cols:', orderCols.map(c=>c.column_name).join(', '));
console.log('Client cols:', clientCols.map(c=>c.column_name).join(', '));

const users = await prisma.$queryRaw`SELECT * FROM "User" LIMIT 3`;
console.log('\nSample users:', JSON.stringify(users, null, 2));

const orders = await prisma.$queryRaw`SELECT id, "userId", "clientId" FROM "Order" WHERE "userId" IS NOT NULL LIMIT 3`;
console.log('\nSample orders with userId:', JSON.stringify(orders, null, 2));

await prisma.$disconnect();
