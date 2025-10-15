# Use official Node.js 20 Alpine image for small size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for caching npm install)
COPY package*.json ./

# Copy Prisma schema before running npm install
COPY prisma ./prisma

# Install only production dependencies
RUN npm install --production

# Copy the rest of your application code
COPY . .

# If you need Prisma client generated in production (optional)
# RUN npx prisma generate --schema=./prisma/schema.prisma

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Set environment variable for Cloud Run port
ENV PORT=8080

# Start the app
CMD ["npm", "start"]
