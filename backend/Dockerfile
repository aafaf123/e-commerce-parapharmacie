FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY backend/package*.json ./
RUN npm install --ignore-scripts

COPY backend/prisma ./prisma
RUN npx prisma generate

COPY backend/ .

RUN mkdir -p uploads/products uploads/profiles logs

EXPOSE 8080

CMD ["node", "src/server.js"]
