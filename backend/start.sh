#!/bin/sh
echo "=== STARTING SERVER ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo YES || echo NO)"
echo "JWT_SECRET set: $([ -n "$JWT_SECRET" ] && echo YES || echo NO)"
echo "=== PRISMA DB PUSH ==="
npx prisma db push --accept-data-loss
echo "=== LAUNCHING NODE ==="
exec node src/server.js
