// This script creates a pool, runs a simple query, prints the result, and closes the pool.

const {
  checkDatabaseConnection,
  closeDatabaseConnection,
  createDatabasePool,
} = require("../config/database");

/**
 * Verify that the configured PostgreSQL database is reachable.
 *
 * @returns {Promise<void>} Resolves after the check completes.
 */
async function main() {
  const databasePool = createDatabasePool();

  try {
    await checkDatabaseConnection(databasePool);
    console.log("PostgreSQL connection successful.");
  } finally {
    await closeDatabaseConnection(databasePool);
  }
}

main().catch((error) => {
  console.error(`PostgreSQL connection failed: ${error.message}`);
  process.exitCode = 1;
});
