#!/bin/sh

echo "[entrypoint] Attente PostgreSQL..."
until pg_isready -h postgres -U "${POSTGRES_USER:-pguser}" -d "${POSTGRES_DB:-parapharmacie}" > /dev/null 2>&1; do
  echo "[entrypoint] DB pas encore prête, retry dans 2s..."
  sleep 2
done
echo "[entrypoint] PostgreSQL prêt."

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
