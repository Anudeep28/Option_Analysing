import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(__dirname, "schema.sql"), "utf8");

try {
  await pool.query(schemaSql);
  console.log("Database schema applied successfully.");
} catch (err) {
  console.error("Failed to apply schema:", err);
  process.exit(1);
} finally {
  await pool.end();
}
