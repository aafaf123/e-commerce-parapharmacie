FROM node:20.19-alpine
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads/products uploads/profiles logs && chmod +x start.sh

EXPOSE ${PORT:-5000}

ENTRYPOINT ["/bin/sh", "start.sh"]
