const dotenv = require("dotenv");
const { Pool } = require("pg");

/**
 * Loads and validates the PostgreSQL connection configuration, creates a
 * connection pool, checks database connectivity, and closes the pool.
 */

dotenv.config();

/**
 * Read and validate the PostgreSQL connection configuration.
 * @returns {{ connectionString: string }} The PostgreSQL connection settings.
 * @throws {Error} If the DATABASE_URL environment variable is not set.
 */
function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.",
    );
  }

  let databaseUrl;

  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error(
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );
  }

  return { connectionString };
}

/**
 * Create a PostgreSQL connection pool.
 *
 * @returns {import("pg").Pool} A configured PostgreSQL connection pool.
 */
function createDatabasePool() {
  const { connectionString } = getDatabaseConfig();

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

/**
 * Check that PostgreSQL is reachable.
 *
 * @param {import("pg").Pool} databasePool - The PostgreSQL connection pool.
 * @returns {Promise<void>} Resolves when the database is reachable.
 */
async function checkDatabaseConnection(databasePool) {
  await databasePool.query("SELECT 1");
}

/**
 * Close all connections managed by the PostgreSQL pool.
 *
 * @param {import("pg").Pool} databasePool - The PostgreSQL connection pool.
 * @returns {Promise<void>} Resolves when the pool is closed.
 */
async function closeDatabaseConnection(databasePool) {
  await databasePool.end();
}

module.exports = {
  checkDatabaseConnection,
  closeDatabaseConnection,
  createDatabasePool,
  getDatabaseConfig,
};
