# ── Stage 1 : Install deps + génère Prisma client ───────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY . .

# ── Stage 2 : image finale ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl postgresql-client && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY . .
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY check-seed.mjs /app/check-seed.mjs

RUN mkdir -p uploads/products uploads/profiles logs && \
    chown -R appuser:appgroup /app && \
    chmod +x /docker-entrypoint.sh

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["/docker-entrypoint.sh"]
