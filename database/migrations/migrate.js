/*
  * Migration module for the PostgreSQL database.
    * This module provides functions to manage database migrations, including
    * applying and rolling back migrations. It uses the 'pg' library to interact
    * with the database.

*/

const fs = require("node:fs/promises");
const path = require("node:path");

const { createDatabasePool } = require("../../config/database");
const migrationDirectory = __dirname;

/**
 * Create the table used to track completed migrations.
 *
 *
 * Each migration filename is stores once in this table. This prevents migrations
 * from being applied multiple times.
 *
 *
 */

async function createMigrationsTable(pool) {
  await databasePool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}



/**
 * Find all the SQL migration files in the migration directory. 
 * The migration runner excludes this Javascript file and anuy non-SQL files.
 * Sorting filenames ensures migrations run in numerical order:
 * 001_create_tables.sql
 * 002_seed_genesis_block.sql
 * @returns {Promise<string[]>} Sorted migration filenames.
 * 
 */

async function getMigrationFiles(){

    const files = await fs.readdir(migrationDirectory);
    // Filter out non-SQL files and sort the remaining files in ascending order
    return files
        .filter((file) => file.endsWith(".sql"))
        .sort();

}



async function getAppliedMigrations(databasePool) {
   



}