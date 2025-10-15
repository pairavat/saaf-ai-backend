# Use Node.js 20 Alpine (lightweight)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy all project files
COPY . .

# Expose the port Cloud Run expects
EXPOSE 8080

# Start your app
CMD ["npm", "start"]
