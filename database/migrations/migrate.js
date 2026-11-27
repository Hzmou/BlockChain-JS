/*
 * Runs the PostgreSQL database migrations in filename order.
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const { createDatabasePool } = require("../../config/database");

const migrationDirectory = __dirname;

/**
 * Create the table used to track completed migrations.
 *
 * Each migration filename is stored once in this table. This prevents a
 * migration from being applied multiple times.
 *
 * @param {import("pg").Pool} databasePool - The PostgreSQL connection pool.
 * @returns {Promise<void>} Resolves after the table is created.
 */
async function createMigrationsTable(databasePool) {
  await databasePool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

/**
 * Find all SQL migration files in the migration directory.
 *
 * The migration runner excludes this JavaScript file and any non-SQL files.
 * Sorting filenames ensures migrations run in numerical order.
 *
 * @returns {Promise<string[]>} Sorted migration filenames.
 */
async function getMigrationFiles() {
  const files = await fs.readdir(migrationDirectory);

  return files
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/**
 * Retrieve the migrations that have already been applied.
 *
 * @param {import("pg").Pool} databasePool - The PostgreSQL connection pool.
 * @returns {Promise<Set<string>>} Applied migration filenames.
 */
async function getAppliedMigrations(databasePool) {
  const result = await databasePool.query(`
    SELECT version
    FROM schema_migrations
    ORDER BY version;
  `);

  return new Set(result.rows.map((row) => row.version));
}

/**
 * Apply one migration inside a database transaction.
 *
 * The migration SQL and tracking-table insert are committed together. If
 * either operation fails, the transaction is rolled back.
 *
 * @param {import("pg").Pool} databasePool - The PostgreSQL connection pool.
 * @param {string} migrationFile - The migration filename.
 * @returns {Promise<void>} Resolves after the migration is applied.
 */
async function applyMigration(databasePool, migrationFile) {
  const migrationPath = path.join(migrationDirectory, migrationFile);
  const migrationSql = await fs.readFile(migrationPath, "utf8");
  const client = await databasePool.connect();

  try {
    console.log(`Applying migration: ${migrationFile}`);

    await client.query("BEGIN");
    await client.query(migrationSql);
    await client.query(
      `
        INSERT INTO schema_migrations (version)
        VALUES ($1)
      `,
      [migrationFile],
    );
    await client.query("COMMIT");

    console.log(`Applied migration: ${migrationFile}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw new Error(
      `Migration failed for ${migrationFile}: ${error.message}`,
      { cause: error },
    );
  } finally {
    client.release();
  }
}

/**
 * Apply every SQL migration that has not already been applied.
 *
 * @returns {Promise<void>} Resolves after all pending migrations are applied.
 */
async function runMigrations() {
  const databasePool = createDatabasePool();

  try {
    await createMigrationsTable(databasePool);

    const migrationFiles = await getMigrationFiles();
    const appliedMigrations = await getAppliedMigrations(databasePool);
    const pendingMigrations = migrationFiles.filter(
      (migrationFile) => !appliedMigrations.has(migrationFile),
    );

    if (pendingMigrations.length === 0) {
      console.log("No pending migrations to apply.");
      return;
    }

    for (const migrationFile of pendingMigrations) {
      await applyMigration(databasePool, migrationFile);
    }

    console.log("All pending migrations have been applied successfully.");
  } finally {
    await databasePool.end();
  }
}

/**
 * Run migrations and report failures without exposing database credentials.
 *
 * @returns {Promise<void>} Resolves when the migration process finishes.
 */
runMigrations().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
});
