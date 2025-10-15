FROM node:20-alpine

WORKDIR /app

# Copy package.json & package-lock.json
COPY package*.json ./

# Copy Prisma schema (and any other source needed for postinstall)
COPY prisma ./prisma

# Install dependencies
RUN npm install --production

# Copy rest of your app
COPY . .

EXPOSE 8080
CMD ["npm", "start"]
