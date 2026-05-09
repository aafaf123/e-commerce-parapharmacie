// backend/src/prismaClient.js
import { PrismaClient } from "@prisma/client";

// Singleton global pour éviter de multiples instances sous forte charge
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;