FROM node:20-alpine

# Install OpenSSL (required by Prisma on Alpine)
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm install

# Copy prisma schema and generate client
COPY src/prisma ./src/prisma
RUN npx prisma generate --schema=src/prisma/schema.prisma

# Copy all source
COPY . .

EXPOSE 5000

# Run migrations then start dev server
CMD sh -c "npx prisma db push --schema=src/prisma/schema.prisma --accept-data-loss && npm run dev"
