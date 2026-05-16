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

RUN apk add --no-cache openssl && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY . .

RUN mkdir -p uploads/products uploads/profiles logs && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8080

CMD ["node", "src/server.js"]
