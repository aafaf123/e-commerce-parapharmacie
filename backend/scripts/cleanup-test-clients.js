import prisma from '../src/prismaClient.js';

const deleted = await prisma.client.deleteMany({
  where: { email: { contains: '@test.com' } }
});
console.log(`Deleted ${deleted.count} test clients`);

const remaining = await prisma.client.count();
console.log(`Remaining clients: ${remaining}`);

await prisma.$disconnect();
