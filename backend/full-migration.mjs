import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('=== MIGRATION COMPLÈTE ===\n');

// 1. Migrer les Users CLIENT vers la table Client
console.log('1. Migration User(CLIENT) → Client...');
const clientUsers = await prisma.$queryRaw`SELECT * FROM "User" WHERE role = 'CLIENT'`;
console.log(`   ${clientUsers.length} clients à migrer`);

for (const u of clientUsers) {
  // Vérifier si déjà migré
  const existing = await prisma.$queryRaw`SELECT id FROM "Client" WHERE email = ${u.email}`;
  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "Client" (id, email, password, "firstName", "lastName", phone, address, whatsapp, "profileImage",
        "notificationEmail", "notificationSMS", "notificationWhatsApp", "notificationPush",
        "isActive", "resetToken", "resetTokenExpiry", "deleteCode", "deleteCodeExpiry",
        "authProvider", cart, "createdAt", "updatedAt")
      VALUES (${u.id}, ${u.email}, ${u.password}, ${u.firstName}, ${u.lastName},
        ${u.phone}, ${u.address}, ${u.whatsapp}, ${u.profileImage},
        ${u.notificationEmail}, ${u.notificationSMS}, ${u.notificationWhatsApp}, ${u.notificationPush},
        ${u.isActive}, ${u.resetToken}, ${u.resetTokenExpiry}, ${u.deleteCode}, ${u.deleteCodeExpiry},
        ${u.authProvider}, ${JSON.stringify(u.cart ?? [])}::jsonb, ${u.createdAt}, ${u.updatedAt})
    `;
    console.log(`   ✅ Migré: ${u.email}`);
  } else {
    console.log(`   ⏭️  Déjà existant: ${u.email}`);
  }
}

// 2. Ajouter colonne clientId dans Order si elle n'existe pas
console.log('\n2. Ajout colonne clientId dans Order...');
await prisma.$executeRaw`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientId" TEXT`;
console.log('   ✅ Colonne clientId ajoutée');

// 3. Copier userId → clientId pour les orders des clients
console.log('\n3. Copie userId → clientId dans Order...');
const updated = await prisma.$executeRaw`
  UPDATE "Order" SET "clientId" = "userId"
  WHERE "userId" IS NOT NULL AND "clientId" IS NULL
`;
console.log(`   ✅ ${updated} orders mis à jour`);

// 4. Ajouter FK constraint (optionnel, prisma db push le fera)
// On laisse prisma db push gérer ça

// 5. Vérifier les Favorites - ajouter clientId si nécessaire
console.log('\n4. Vérification Favorite...');
const favCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='Favorite'`;
console.log('   Colonnes:', favCols.map(c=>c.column_name).join(', '));

const hasClientId = favCols.some(c => c.column_name === 'clientId');
const hasUserId = favCols.some(c => c.column_name === 'userId');

if (hasUserId && !hasClientId) {
  await prisma.$executeRaw`ALTER TABLE "Favorite" RENAME COLUMN "userId" TO "clientId"`;
  console.log('   ✅ Favorite.userId → clientId renommé');
} else {
  console.log('   ✅ Favorite OK');
}

// 6. Vérifier SearchHistory
console.log('\n5. Vérification SearchHistory...');
const shCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='SearchHistory'`;
const shHasClientId = shCols.some(c => c.column_name === 'clientId');
const shHasUserId = shCols.some(c => c.column_name === 'userId');
if (shHasUserId && !shHasClientId) {
  await prisma.$executeRaw`ALTER TABLE "SearchHistory" RENAME COLUMN "userId" TO "clientId"`;
  console.log('   ✅ SearchHistory.userId → clientId renommé');
} else {
  console.log('   ✅ SearchHistory OK');
}

// 7. Vérifier Notification
console.log('\n6. Vérification Notification...');
const notifCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='Notification'`;
const notifHasClientId = notifCols.some(c => c.column_name === 'clientId');
const notifHasUserId = notifCols.some(c => c.column_name === 'userId');
if (notifHasUserId && !notifHasClientId) {
  await prisma.$executeRaw`ALTER TABLE "Notification" RENAME COLUMN "userId" TO "clientId"`;
  console.log('   ✅ Notification.userId → clientId renommé');
} else {
  console.log('   ✅ Notification OK');
}

// 8. Vérifier Review
console.log('\n7. Vérification Review...');
const reviewCols = await prisma.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name='Review'`;
const reviewHasClientId = reviewCols.some(c => c.column_name === 'clientId');
const reviewHasUserId = reviewCols.some(c => c.column_name === 'userId');
if (reviewHasUserId && !reviewHasClientId) {
  await prisma.$executeRaw`ALTER TABLE "Review" RENAME COLUMN "userId" TO "clientId"`;
  console.log('   ✅ Review.userId → clientId renommé');
} else {
  console.log('   ✅ Review OK');
}

await prisma.$disconnect();
console.log('\n=== MIGRATION TERMINÉE ===');
