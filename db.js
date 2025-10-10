// db.js
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // from .env
  ssl: {
    rejectUnauthorized: false, // needed for Neon and other cloud DBs
  },
});

export default pool;
