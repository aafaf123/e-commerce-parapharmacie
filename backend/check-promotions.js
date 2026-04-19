import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const now = new Date();
console.log('Heure actuelle:', now.toISOString());
const promotions = await prisma.promotion.findMany({ include: { stats: true }, orderBy: { order: 'asc' } });
console.log('Total promotions en base:', promotions.length);
promotions.forEach(p => {
  console.log('---');
  console.log('ID:', p.id);
  console.log('Titre:', p.title);
  console.log('Active:', p.active);
  console.log('StartDate:', p.startDate?.toISOString());
  console.log('EndDate:', p.endDate?.toISOString());
  const startOk = p.startDate <= now;
  const endOk = p.endDate >= now;
  console.log('StartDate OK (<=now):', startOk);
  console.log('EndDate OK (>=now):', endOk);
});
await prisma.$disconnect();
