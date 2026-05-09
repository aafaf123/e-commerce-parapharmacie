import prisma from '../src/prismaClient.js';

await prisma.orderItem.deleteMany({});
await prisma.order.deleteMany({});
await prisma.stockMovement.deleteMany({});
await prisma.product.updateMany({ where: { stock: { lt: 5 } }, data: { stock: 50 } });

const [orders, movements] = await Promise.all([prisma.order.count(), prisma.stockMovement.count()]);
console.log(`Remaining: ${orders} orders, ${movements} movements`);
await prisma.$disconnect();
