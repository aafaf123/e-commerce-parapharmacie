import prisma from '../src/prismaClient.js';

// Delete test orders (from perf_user accounts)
const testClients = await prisma.client.findMany({
  where: { email: { contains: '@test.com' } },
  select: { id: true }
});
const clientIds = testClients.map(c => c.id);

const deletedItems = await prisma.orderItem.deleteMany({
  where: { order: { clientId: { in: clientIds } } }
});
const deletedOrders = await prisma.order.deleteMany({
  where: { clientId: { in: clientIds } }
});
const deletedMovements = await prisma.stockMovement.deleteMany({
  where: { reason: { contains: 'ORD-' } }
});

// Reset negative stock
await prisma.product.updateMany({
  where: { stock: { lt: 0 } },
  data: { stock: 10 }
});

console.log(`Deleted: ${deletedItems.count} items, ${deletedOrders.count} orders, ${deletedMovements.count} movements`);

const remaining = await prisma.order.count();
console.log(`Remaining orders: ${remaining}`);

await prisma.$disconnect();
