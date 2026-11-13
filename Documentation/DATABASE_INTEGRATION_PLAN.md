# PostgreSQL Database Integration Plan

## Branch

```bash
git switch -c feature/postgres-database-integration
```

## Goal

Replace the current in-memory blockchain persistence with PostgreSQL while preserving:

- Existing blockchain behavior.
- Existing API routes and response shapes.
- Browser wallet signing and private-key protection.
- Mining and transaction workflows.
- Existing frontend behavior.
- Existing automated tests.

After this branch is complete, blocks, transactions, pending transfers, and wallet-related public data should survive server restarts.

## Current State

The application currently stores blockchain state in memory. This means:

- Blocks are lost when the server restarts.
- Pending transactions are lost when the server restarts.
- Wallet balances are derived only from in-memory data.
- There is no persistent transaction history.
- There is no database-backed repository layer.

The existing API should remain compatible with the database-backed implementation.

## Database Decision

PostgreSQL was selected because the application contains strongly related data:

- Wallets.
- Blocks.
- Transactions.
- Pending and confirmed transaction states.
- Wallet addresses.
- Balances.
- Transaction history.

PostgreSQL provides:

- Relational data modeling.
- Foreign-key constraints.
- Reliable database transactions.
- Strong consistency.
- Support for concurrent API requests.
- JSON support when flexible data is needed.
- Node.js compatibility through the `pg` package.
- A practical path from local development to production deployment.

The database decision is documented in:

```text
Documentation/DATABASE_CHOICE.md
```

## Alternatives Considered

### MySQL

MySQL would be a valid choice because it supports relational tables, foreign keys, transactions, and mature administration tools. PostgreSQL was selected because it provides a strong feature set for future application development and is already available in the development environment.

### SQLite

SQLite would be easier to configure because it does not require a separate database server. PostgreSQL is preferred because this project may support concurrent API requests and is expected to grow beyond a single-user prototype.

### MongoDB

MongoDB was not selected because the application has clear relationships between wallets, transactions, blocks, addresses, balances, and pending transaction states. PostgreSQL provides stronger relational constraints for this use case.

### LevelDB

LevelDB was not selected because it is a key-value database. It would require custom indexing and lookup logic for wallet balances, transactions by address, transactions by block, and pending transaction state.

## Technology Stack

```text
Database: PostgreSQL
Node.js driver: pg
Application server: Express
Blockchain service: Existing BlockchainService
Frontend: Existing vanilla JavaScript dashboard
Testing: Node.js node:test
Migration approach: Versioned SQL migration files
```

## Implementation Principles

1. Preserve the existing API contract.
2. Keep blockchain business logic in `BlockchainService`.
3. Keep SQL queries inside repository modules.
4. Use parameterized queries.
5. Use database transactions for multi-step writes.
6. Never store private keys.
7. Keep public-key and signature verification on the server.
8. Preserve existing HTTP status codes and error behavior where practical.
9. Keep the frontend independent from the database implementation.
10. Add tests for persistence and transaction consistency.
11. Make connection failures explicit.
12. Do not silently fall back to in-memory storage.

## Proposed Architecture

```text
Browser dashboard
        ↓
Express API routes
        ↓
BlockchainService
        ↓
Repository layer
        ↓
PostgreSQL connection pool
        ↓
PostgreSQL database
```

### Express API Routes

Routes remain responsible for:

- Receiving HTTP requests.
- Validating request shape.
- Calling the service layer.
- Returning JSON responses.
- Returning correct HTTP status codes.

### BlockchainService

The service remains responsible for:

- Transaction rules.
- Address validation.
- Balance calculations.
- Mining behavior.
- Mining rewards.
- Chain validation.
- Coordination between repositories.
- Database transaction boundaries for complex operations.

### Repository Layer

Repositories are responsible for:

- Executing SQL queries.
- Reading and writing database records.
- Mapping database rows to application objects.
- Avoiding SQL logic in route handlers.
- Returning explicit database errors.

## Proposed Project Structure

```text
config/
  database.js

database/
  migrations/
    001_create_wallets.sql
    002_create_blocks.sql
    003_create_transactions.sql
    004_seed_genesis_block.sql

repositories/
  walletRepository.js
  blockRepository.js
  transactionRepository.js

services/
  blockchainService.js

test/
  database.test.js
  repository.test.js
  api.test.js
```

The exact structure may be adjusted to match existing project conventions.

## Environment Configuration

Use environment variables for database credentials:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/blockchain
PORT=3000
```

Commit an example file:

```text
.env.example
```

Example:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/blockchain
PORT=3000
```

Do not commit:

```text
.env
.env.*
```

The application must fail clearly when required database configuration is missing or invalid.

## Database Schema

### Wallets

The `wallets` table stores public wallet information only:

```sql
CREATE TABLE wallets (
    id BIGSERIAL PRIMARY KEY,
    address VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Private keys must never be stored in this table.

### Blocks

The `blocks` table stores mined blockchain blocks:

```sql
CREATE TABLE blocks (
    id BIGSERIAL PRIMARY KEY,
    block_index INTEGER NOT NULL UNIQUE,
    timestamp BIGINT NOT NULL,
    hash VARCHAR(64) NOT NULL UNIQUE,
    previous_hash VARCHAR(64) NOT NULL,
    nonce BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The fields represent:

- `block_index`: The block's position in the chain.
- `timestamp`: The block timestamp.
- `hash`: The block hash.
- `previous_hash`: The hash of the previous block.
- `nonce`: The proof-of-work nonce.
- `created_at`: The database insertion time.

### Transactions

The `transactions` table stores signed transactions and their state:

```sql
CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    from_address VARCHAR(64) NOT NULL,
    to_address VARCHAR(64) NOT NULL,
    amount NUMERIC(20, 8) NOT NULL CHECK (amount > 0),
    public_key TEXT,
    signature TEXT,
    block_id BIGINT REFERENCES blocks(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT transactions_status_check
        CHECK (status IN ('pending', 'confirmed'))
);
```

Pending transactions have:

```text
block_id = NULL
status = 'pending'
```

Confirmed transactions have:

```text
block_id = the containing block ID
status = 'confirmed'
```

## Block and Transaction Relationship

```text
blocks.id
    ↓
transactions.block_id
```

This relationship allows the application to:

- Find all transactions in a block.
- Find the block containing a transaction.
- Find all pending transactions.
- Mark transactions as confirmed after mining.
- Rebuild the chain from persistent records.

## Balance Calculation

The first implementation should calculate balances from confirmed transaction history:

```text
Balance =
  confirmed incoming amounts
  + mining rewards
  - confirmed outgoing amounts
```

A cached balance table should not be added initially unless performance testing demonstrates a need. Calculating balances from confirmed history avoids synchronization problems while persistence is being introduced.

## Transaction Submission Flow

```text
1. Receive the signed transaction from the browser.
2. Validate the request shape.
3. Validate sender and recipient addresses.
4. Validate the amount.
5. Verify the public key and signature.
6. Check the sender balance.
7. Insert the transaction as pending.
8. Return the existing success response.
```

The API continues accepting:

```json
{
  "fromAddress": "sender-address",
  "toAddress": "recipient-address",
  "amount": 10,
  "publicKey": "sender-public-key",
  "signature": "transaction-signature"
}
```

Private keys must never be accepted, stored, or returned.

## Mining Flow

```text
1. Validate the miner address.
2. Begin a database transaction.
3. Load the latest persisted block.
4. Load pending transactions.
5. Validate pending transactions.
6. Create the next block.
7. Perform proof-of-work.
8. Insert the new block.
9. Associate included transactions with the block.
10. Mark included transactions as confirmed.
11. Persist the mining reward.
12. Commit the database transaction.
13. Return the mined block.
```

If any step fails:

```text
1. Roll back the database transaction.
2. Preserve the previous chain state.
3. Return an explicit error.
```

## Chain Loading

When the server starts:

```text
1. Connect to PostgreSQL.
2. Verify that required tables exist.
3. Load blocks ordered by block_index.
4. Load transactions associated with each block.
5. Load pending transactions.
6. Reconstruct the blockchain state.
7. Validate the reconstructed chain.
8. Start accepting API requests only after initialization succeeds.
```

The server must not silently start with an empty chain if the database connection fails.

## Migrations

Create versioned migration files:

```text
001_create_wallets.sql
002_create_blocks.sql
003_create_transactions.sql
004_seed_genesis_block.sql
```

Migrations should be:

- Versioned.
- Reviewable.
- Repeatable where practical.
- Reversible where supported by the migration tool.
- Safe to run against a clean development database.

## Repository Responsibilities

### Wallet Repository

Implement:

```text
createWallet(address)
findWalletByAddress(address)
listWallets()
```

### Block Repository

Implement:

```text
createBlock(block)
findBlockByIndex(index)
findLatestBlock()
listBlocks()
findBlockTransactions(blockId)
```

Blocks must be returned in ascending `block_index` order.

### Transaction Repository

Implement:

```text
createPendingTransaction(transaction)
listPendingTransactions()
findTransactionsByAddress(address)
attachTransactionsToBlock(transactionIds, blockId)
markTransactionsConfirmed(transactionIds, blockId)
listConfirmedTransactions()
```

All SQL queries must use parameterized values.

## API Compatibility

These routes must continue working:

```text
GET /api/chain
GET /api/chain/validity
GET /api/balances/:address
GET /api/transactions/pending
POST /api/transactions
POST /api/mining
```

The frontend should not need database-specific changes.

## Error Handling

The database integration must:

- Log server-side database errors safely.
- Avoid exposing credentials.
- Return generic server errors for unexpected database failures.
- Preserve validation errors for clients.
- Roll back failed multi-step operations.
- Avoid success responses after failed writes.
- Avoid silently falling back to memory.
- Detect connection failures during startup.

## Security Requirements

The database may store:

```text
- Wallet addresses
- Public keys
- Transaction signatures
- Signed transaction fields
- Transaction history
- Block data
- Transaction status
```

The database must not store:

```text
- Private keys
- Unencrypted wallet secrets
- Browser wallet memory
- Private-key backups without encryption
```

The server must never request, return, log, or persist a private key.

## Implementation Phases

### Phase 1: Branch and Baseline

- [ ] Create `feature/postgres-database-integration`.
- [ ] Confirm the branch starts from updated `main`.
- [ ] Run `npm test`.
- [ ] Run `npm run build:client`.
- [ ] Confirm `.env` is ignored.
- [ ] Confirm no secrets are committed.

Acceptance criteria:

- Existing tests pass.
- The frontend build passes.
- The repository has no committed secrets.

### Phase 2: PostgreSQL Setup

- [ ] Add the `pg` dependency.
- [ ] Add PostgreSQL environment configuration.
- [ ] Add `.env.example`.
- [ ] Add a PostgreSQL connection pool.
- [ ] Add connection error handling.
- [ ] Add graceful pool shutdown.
- [ ] Add a database health check.

Acceptance criteria:

- The application connects to PostgreSQL.
- Missing configuration produces a clear error.
- Invalid configuration produces a clear error.
- Credentials are not logged.

### Phase 3: Database Migrations

- [ ] Add the migration mechanism.
- [ ] Create the wallets migration.
- [ ] Create the blocks migration.
- [ ] Create the transactions migration.
- [ ] Add block-to-transaction relationships.
- [ ] Add address and hash uniqueness constraints.
- [ ] Add amount validation constraints.
- [ ] Add transaction status constraints.
- [ ] Add genesis block initialization.
- [ ] Test migrations on a clean database.
- [ ] Test running migrations more than once.

Acceptance criteria:

- All required tables exist.
- Constraints are applied.
- The genesis block is present.
- Migrations are repeatable.
- The schema matches this plan.

### Phase 4: Repository Layer

- [ ] Implement the wallet repository.
- [ ] Implement the block repository.
- [ ] Implement the transaction repository.
- [ ] Use parameterized SQL queries.
- [ ] Map database rows to application objects.
- [ ] Add repository error handling.
- [ ] Add repository tests.

Acceptance criteria:

- Required records can be created and read.
- Duplicate addresses and hashes are rejected.
- Pending and confirmed transactions are distinguishable.
- Blocks are returned in order.
- SQL injection risks are avoided through parameterization.

### Phase 5: Persistent Blockchain Loading

- [ ] Load blocks from PostgreSQL on startup.
- [ ] Load transactions associated with blocks.
- [ ] Load pending transactions.
- [ ] Reconstruct the blockchain object.
- [ ] Validate the reconstructed chain.
- [ ] Reject invalid persisted chains.
- [ ] Prevent API startup before initialization succeeds.

Acceptance criteria:

- Data is loaded after a restart.
- Chain validity is calculated from persisted data.
- Pending transactions remain available after a restart.
- Database failures stop startup clearly.
- The application does not silently reset the chain.

### Phase 6: Persistent Transaction Submission

- [ ] Update transaction submission to use PostgreSQL.
- [ ] Verify signatures before insertion.
- [ ] Validate sender balances from persisted history.
- [ ] Insert valid transactions as pending.
- [ ] Preserve the current API response.
- [ ] Preserve private-key protection.
- [ ] Add transaction persistence tests.

Acceptance criteria:

- Valid signed transactions are persisted.
- Invalid signatures are rejected.
- Insufficient balances are rejected.
- Pending transactions survive a restart.
- API behavior remains compatible.

### Phase 7: Persistent Mining

- [ ] Load the latest block from PostgreSQL.
- [ ] Load pending transactions.
- [ ] Create the next block.
- [ ] Perform proof-of-work.
- [ ] Persist the new block.
- [ ] Persist or associate the mining reward.
- [ ] Associate included transactions with the block.
- [ ] Mark included transactions as confirmed.
- [ ] Use a database transaction for the complete mining operation.
- [ ] Roll back on failure.
- [ ] Add mining persistence tests.

Acceptance criteria:

- Mining creates a persistent block.
- Pending transactions become confirmed.
- Pending transaction results are updated.
- Mining rewards update balances.
- The chain remains valid after mining.
- Partial writes do not remain after failure.

### Phase 8: API and Frontend Regression Testing

- [ ] Run the existing API tests against PostgreSQL.
- [ ] Verify all read endpoints.
- [ ] Verify all write endpoints.
- [ ] Verify the existing dashboard loads.
- [ ] Verify wallet creation.
- [ ] Verify balance lookup.
- [ ] Verify transaction submission.
- [ ] Verify mining.
- [ ] Verify pending transaction refresh.
- [ ] Verify private-key protection.
- [ ] Verify the Vite frontend build.

Acceptance criteria:

- Existing frontend workflows continue working.
- No API route requires database-specific frontend code.
- Existing tests pass.
- New persistence tests pass.
- The dashboard continues to operate.

### Phase 9: Documentation and Cleanup

- [ ] Update `README.md`.
- [ ] Document PostgreSQL installation.
- [ ] Document database creation.
- [ ] Document environment variables.
- [ ] Document migration commands.
- [ ] Document test commands.
- [ ] Document reset procedures.
- [ ] Document private-key security.
- [ ] Remove temporary debugging code.
- [ ] Review database error messages.
- [ ] Run formatting checks.
- [ ] Review the final diff.

Acceptance criteria:

- A new developer can set up PostgreSQL from the documentation.
- Secrets are not documented as committed values.
- Migration and test commands are clear.
- The final branch contains no unrelated changes.

## Testing Plan

### Existing Tests

Keep all existing tests passing:

```bash
npm test
```

### Database Tests

Add coverage for:

- Successful database connections.
- Missing `DATABASE_URL`.
- Invalid database configuration.
- Connection failures.
- Clean connection shutdown.
- Migrations on a clean database.
- Repeatable migrations.
- Required tables and constraints.
- Genesis block initialization.

### Repository Tests

Verify:

- Creating and retrieving wallets.
- Rejecting duplicate wallet addresses.
- Creating and retrieving blocks.
- Returning blocks in order.
- Creating pending transactions.
- Retrieving pending transactions.
- Marking transactions as confirmed.
- Finding transactions by address.
- Rejecting invalid amounts.
- Enforcing foreign-key relationships.

### Persistence Tests

Verify that:

```text
1. A block is created.
2. The service is stopped or disconnected.
3. A new service instance is created.
4. The blockchain is loaded from PostgreSQL.
5. The block still exists.
```

### Mining Tests

Verify that mining:

- Persists a new block.
- Persists the mining reward.
- Includes pending transactions.
- Marks included transactions as confirmed.
- Removes transactions from pending results.
- Updates wallet balances.
- Preserves chain validity.
- Rolls back completely when persistence fails.

## Documentation Plan

Update `README.md` with:

- PostgreSQL installation requirements.
- Database creation instructions.
- Required environment variables.
- Migration commands.
- Server startup instructions.
- Test commands.
- Development database reset instructions.
- Private-key storage limitations.

Example setup:

```bash
createdb blockchain
cp .env.example .env
npm install
npm run migrate
npm start
```

The exact migration command will depend on the migration tool selected.

## Final Validation Checklist

- [ ] PostgreSQL is required and documented.
- [ ] Database connection configuration works.
- [ ] Migrations run successfully.
- [ ] Migrations are repeatable.
- [ ] Genesis block is created correctly.
- [ ] Blocks persist after restart.
- [ ] Transactions persist after restart.
- [ ] Pending transactions persist after restart.
- [ ] Confirmed transactions are associated with blocks.
- [ ] Mining rewards persist correctly.
- [ ] Balances are calculated correctly.
- [ ] Chain validity is preserved.
- [ ] Signed transactions still work.
- [ ] Invalid signatures are rejected.
- [ ] Invalid addresses are rejected.
- [ ] Insufficient balances are rejected.
- [ ] Database failures are handled explicitly.
- [ ] Private keys never enter the database.
- [ ] Private keys never appear in logs.
- [ ] Private keys never appear in API responses.
- [ ] Existing API routes continue working.
- [ ] Existing frontend workflows continue working.
- [ ] `npm test` passes.
- [ ] `npm run build:client` passes.
- [ ] Documentation is updated.

## Completion Criteria

The PostgreSQL integration is complete when:

1. Blocks are stored in PostgreSQL.
2. Pending and confirmed transactions are stored in PostgreSQL.
3. Blockchain state survives server restarts.
4. Mining and transaction workflows remain functional.
5. Existing API responses remain compatible.
6. The browser dashboard continues working.
7. Database operations use repositories and parameterized queries.
8. Multi-step writes use database transactions.
9. Private keys are never stored or exposed.
10. Automated and manual verification passes.
11. Setup and migration instructions are documented.
12. The complete test suite passes.

## Decision Summary

```text
Selected database: PostgreSQL
Node.js driver: pg
Persistence model: Relational PostgreSQL schema
Migration model: Versioned SQL migrations
Private-key storage: Never stored
API strategy: Preserve existing API routes
Frontend strategy: Keep existing dashboard compatible
Branch: feature/postgres-database-integration
```