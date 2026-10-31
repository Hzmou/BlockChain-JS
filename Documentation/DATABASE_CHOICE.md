# Database Choice: PostgreSQL

## Decision

This project will use **PostgreSQL** for database integration.

PostgreSQL was selected because the application contains strongly related data, including:

- Wallets
- Blocks
- Transactions
- Pending transactions
- Balances
- Transaction history

These relationships are better represented with a relational database than with a document or key-value database.

The following is the Database schema that is going to be used for this project:

wallets
  id
  address
  created_at

blocks
  id
  block_index
  timestamp
  hash
  previous_hash
  nonce
  created_at

transactions
  id
  from_address
  to_address
  amount
  public_key
  signature
  block_id
  status
  created_at

## Why PostgreSQL?

PostgreSQL provides:

- Strong relational data modeling.
- Foreign keys and database constraints.
- Reliable database transactions.
- Consistent updates across related records.
- Good support for concurrent API requests.
- JSON support when flexible data storage is needed.
- Compatibility with Node.js through the `pg` package.
- A strong path from local development to production deployment.
- Good support for testing and database migrations.

PostgreSQL is also already installed and familiar to the project developer, which reduces setup and learning overhead.

## Database Alternatives Considered

### MySQL

MySQL would also be a valid choice because it provides:

- Relational tables.
- Foreign keys.
- Transactions.
- Good developer tooling.
- Familiarity through MySQL Workbench.

PostgreSQL was selected because it provides a broader feature set for future application development and is a strong fit for the project's relational data model.

### SQLite

SQLite would be useful for the fastest local implementation because:

- It does not require a separate database server.
- The database is stored in a local file.
- It is simple to configure.
- It is useful for small prototypes and automated tests.

However, PostgreSQL is preferred because this project is expected to evolve beyond a single-user in-memory prototype. PostgreSQL provides a more realistic foundation for concurrent API requests and future deployment.

### MongoDB

MongoDB was not selected because the application's data has clear relationships between:

- Wallets and transactions.
- Transactions and blocks.
- Addresses and balances.
- Pending transactions and their eventual mined blocks.

These relationships can be represented in MongoDB, but PostgreSQL provides stronger consistency, constraints, and relationship management for this use case.

### LevelDB

LevelDB was not selected because it is a key-value database. Using it would require the application to implement additional indexing and relationship-management logic for:

- Looking up wallet balances.
- Finding transactions by address.
- Connecting transactions to blocks.
- Managing pending transaction states.

A relational database provides these capabilities more naturally.

## Planned PostgreSQL Stack

```text
Database: PostgreSQL
Node.js driver: pg
Migration approach: Database migration files
API layer: Existing Express API
Service layer: Existing BlockchainService
Repository layer: PostgreSQL data-access repositories