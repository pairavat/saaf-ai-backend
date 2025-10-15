# Node.js 20 Alpine for small size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json & package-lock.json first (for caching)
COPY package*.json ./

# Copy Prisma schema (required for postinstall)
COPY prisma ./prisma

# Install dependencies
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose Cloud Run default port
ENV PORT=8080
EXPOSE 8080

# Start the app (ESM entrypoint)
CMD ["node", "--experimental-modules", "index.mjs"]
