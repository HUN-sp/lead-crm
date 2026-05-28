FROM node:20-alpine

# Prisma requires OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

# Copy the rest of the source
COPY . .

EXPOSE 3000

# Run DB push to sync schema, then start the server
CMD ["sh", "-c", "npx prisma db push && node server.js"]
