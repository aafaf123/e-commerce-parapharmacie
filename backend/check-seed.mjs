import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const count = await p.user.count().catch(() => 0);
await p.$disconnect();
process.exit(count > 0 ? 0 : 1);
