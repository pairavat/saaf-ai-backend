# ─────────────────────────────────────────────
# Stage 1: Build the app (with dependencies)
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies required for Prisma
RUN apk add --no-cache openssl python3 make g++

# Copy package files first for caching
COPY package*.json ./

# Copy Prisma schema (needed for generate)
COPY prisma ./prisma

# Install dependencies (including dev for Prisma)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy the full source code
COPY . .

# ─────────────────────────────────────────────
# Stage 2: Production image (smaller, faster)
# ─────────────────────────────────────────────
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy OpenSSL (for Prisma)
RUN apk add --no-cache openssl

# Copy built app and dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/index.mjs ./index.mjs
COPY --from=builder /app/config ./config
COPY --from=builder /app/controller ./controller
COPY --from=builder /app/middlewares ./middlewares
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/utils ./utils

# Environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check (optional but recommended for Cloud Run)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

# Expose the port expected by Cloud Run and Render
EXPOSE 8080

# Start the app
CMD ["node", "index.mjs"]
