#!/bin/sh

echo "[entrypoint] Sync schema Prisma..."
npx prisma db push --skip-generate 2>&1

echo "[entrypoint] Vérification seed..."
if node /app/check-seed.mjs; then
  echo "[entrypoint] Données existantes, seed ignoré."
else
  echo "[entrypoint] Seed initial..."
  node prisma/seed.js
fi

echo "[entrypoint] Démarrage serveur..."
exec node src/server.js
