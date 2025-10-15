# Use Node.js 20 Alpine image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Copy Prisma schema before npm install
COPY prisma ./prisma

# Install production dependencies
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose Cloud Run default port
ENV PORT=8080
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
