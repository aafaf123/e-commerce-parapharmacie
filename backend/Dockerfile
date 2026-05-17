FROM node:20.19-alpine
WORKDIR /app

EXPOSE 8080

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads/products uploads/profiles logs && chmod +x start.sh

ENTRYPOINT ["/bin/sh", "start.sh"]
