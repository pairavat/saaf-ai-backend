// ES Module-compatible import for CommonJS modules
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

// Helper to handle BigInt serialization in JSON responses
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export default prisma;
