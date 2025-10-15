# Use Node.js 20 Alpine
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install OpenSSL (needed for Prisma)
RUN apk add --no-cache openssl

# Copy package files first (for layer caching)
COPY package*.json ./

# Copy the prisma directory before npm install (to allow prisma generate)
COPY prisma ./prisma

# Install dependencies (including dev for prisma generate)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the source code
COPY . .

# Expose the port Cloud Run expects
ENV PORT=8080
EXPOSE 8080

# Start the app
CMD ["node", "index.mjs"]
