# Blockchain Application System Design

## 1. Overview

BlockChain-JS is a browser-based blockchain application that allows users to:

- Create browser-based wallets.
- Sign transactions.
- Submit transactions to an Express API.
- Mine pending transactions into blocks.
- View the blockchain and balances.
- Validate the blockchain.
- Persist blockchain data in PostgreSQL.

The application currently uses an in-memory blockchain service while the PostgreSQL repository integration is being implemented.

## 2. System Goals

The system is designed to:

1. Provide a simple blockchain demonstration application.
2. Support browser wallet creation and transaction signing.
3. Validate transaction signatures on the server.
4. Persist blocks, wallets, and transactions.
5. Preserve blockchain and transaction ordering.
6. Keep private keys outside the server and database.
7. Maintain compatibility with the existing HTTP API.
8. Separate business logic, persistence, and presentation concerns.

## 3. High-Level Architecture

```text
+-----------------------------+
|        Browser Client       |
|-----------------------------|
| Dashboard                   |
| Wallet creation             |
| Transaction signing         |
| Chain and balance views     |
+-------------+---------------+
              |
              | HTTP / JSON
              v
+-----------------------------+
|       Express API Server    |
|-----------------------------|
| Routes                      |
| Validation                 |
| Error responses             |
+-------------+---------------+
              |
              v
+-----------------------------+
|    BlockchainService        |
|-----------------------------|
| Submit transactions         |
| Mine blocks                 |
| Calculate balances          |
| Validate the chain          |
| Coordinate repositories     |
+-------------+---------------+
              |
              v
+-----------------------------+
|       Repository Layer      |
|-----------------------------|
| WalletRepository            |
| BlockRepository             |
| TransactionRepository       |
+-------------+---------------+
              |
              v
+-----------------------------+
|    PostgreSQL Connection    |
|        Pool                 |
+-------------+---------------+
              |
              v
+-----------------------------+
|        PostgreSQL           |
|-----------------------------|
| wallets                     |
| blocks                      |
| transactions                |
| schema_migrations           |
+-----------------------------+
```

## 4. Main Components

### 4.1 Browser Client

The browser client is located under `public/`.

Responsibilities include:

- Displaying the blockchain dashboard.
- Creating browser wallets.
- Keeping private keys on the client.
- Signing transactions before submission.
- Calling backend API endpoints.
- Displaying pending transactions.
- Displaying balances and chain validity.
- Providing loading and error states.
- Supporting responsive and accessible interactions.

The browser must never send private keys to the server.

### 4.2 Express API Server

The Express server exposes HTTP endpoints for the browser client.

Current API endpoints include:

```text
GET  /api/chain
GET  /api/chain/validity
GET  /api/balances/:address
GET  /api/transactions/pending
POST /api/transactions
POST /api/mining
```

The API layer is responsible for:

- Parsing HTTP requests.
- Validating request data.
- Calling the blockchain service.
- Returning JSON responses.
- Returning appropriate HTTP status codes.
- Avoiding direct database queries.

The API should not contain blockchain rules or SQL statements.

### 4.3 Blockchain Service

The blockchain service contains the application’s blockchain business logic.

Responsibilities include:

- Accepting submitted transactions.
- Verifying transaction signatures.
- Managing pending transactions.
- Mining new blocks.
- Creating mining reward transactions.
- Calculating wallet balances.
- Validating block hashes.
- Validating block links.
- Coordinating repositories during database integration.

The service should decide what the application does, while repositories decide how data is stored.

### 4.4 Repository Layer

The repository layer provides database access methods.

Planned repositories include:

```text
repositories/
  walletRepository.js
  blockRepository.js
  transactionRepository.js
```

Responsibilities include:

- Executing parameterized SQL queries.
- Reading and writing database records.
- Mapping database column names to JavaScript properties.
- Converting PostgreSQL numeric values to JavaScript values.
- Returning `null` when an optional record is not found.
- Providing contextual database errors.
- Preserving block and transaction ordering.

Repositories should not contain mining rules, balance logic, or HTTP behavior.

### 4.5 PostgreSQL Connection Pool

The database connection pool is managed by `config/database.js`.

Responsibilities include:

- Loading `DATABASE_URL`.
- Validating database configuration.
- Creating PostgreSQL connections.
- Reusing connections efficiently.
- Checking database connectivity.
- Closing connections during shutdown.

Repositories receive the pool through dependency injection instead of creating their own database connections.

### 4.6 Migration System

Database migrations are located under `database/migrations/`.

The migration runner:

1. Creates the `schema_migrations` table.
2. Finds SQL migration files.
3. Sorts migrations by filename.
4. Skips migrations already recorded.
5. Runs each migration inside a transaction.
6. Records successful migrations.
7. Rolls back failed migrations.
8. Closes the connection pool.

Migrations make database setup repeatable across development and deployment environments.

## 5. Data Model

### 5.1 `blocks`

Stores blockchain block metadata.

Important fields:

```text
id
block_index
timestamp
hash
previous_hash
nonce
created_at
```

Constraints include:

- Primary key on `id`.
- Unique `block_index`.
- Unique `hash`.

Blocks are ordered by `block_index`.

### 5.2 `transactions`

Stores pending and confirmed transactions.

Important fields:

```text
id
from_address
to_address
amount
public_key
signature
block_id
transaction_position
status
created_at
```

Important rules:

- `from_address` may be `NULL` for mining rewards.
- `to_address` is required.
- `amount` must be positive.
- `status` represents pending or confirmed state.
- `block_id` links confirmed transactions to blocks.
- `transaction_position` preserves transaction order inside a block.

The relationship is:

```text
blocks.id 1 ---- many transactions.block_id
```

### 5.3 `wallets`

Stores public wallet addresses.

Important fields:

```text
id
address
created_at
```

Wallet records do not contain private keys.

### 5.4 `schema_migrations`

Tracks applied migrations.

Important fields:

```text
version
applied_at
```

This table prevents migrations from being applied multiple times.

## 6. Main Data Flows

### 6.1 Wallet Creation

```text
1. Browser generates a key pair.
2. Browser derives the public wallet address.
3. Private key remains in the browser.
4. Browser optionally sends the public address to the API.
5. API calls WalletRepository.
6. WalletRepository stores the public address.
```

The private key must never be stored in PostgreSQL.

### 6.2 Submit Transaction

```text
1. User enters recipient and amount.
2. Browser creates the transaction payload.
3. Browser signs the transaction.
4. Browser sends the transaction and signature to the API.
5. API validates the request.
6. BlockchainService verifies the signature.
7. TransactionRepository stores the transaction as pending.
8. API returns the stored transaction.
```

### 6.3 Mine Transactions

```text
1. Miner requests mining.
2. BlockchainService loads pending transactions.
3. A mining reward transaction is created.
4. A new block is constructed.
5. The block is mined and hashed.
6. BlockRepository stores the block.
7. TransactionRepository attaches transactions to the block.
8. Transactions are marked as confirmed.
9. The updated block is returned to the client.
```

Block creation and transaction confirmation should eventually be coordinated using a database transaction so partial writes cannot leave inconsistent data.

### 6.4 Load the Chain

```text
1. Application starts.
2. BlockchainService loads blocks ordered by block_index.
3. Transactions are loaded for each block.
4. Transactions are ordered by transaction_position.
5. Blocks are reconstructed into application objects.
6. Chain validation runs against the reconstructed chain.
```

This allows the application to recover blockchain state after a server restart.

### 6.5 Calculate a Balance

```text
1. Client requests a balance for an address.
2. API calls BlockchainService.
3. Service loads confirmed transactions.
4. Incoming amounts are added.
5. Outgoing amounts are subtracted.
6. The calculated balance is returned.
```

Balance calculation belongs to the service layer, not the repository layer.

## 7. Security Design

### Private Keys

Private keys:

- Are generated in the browser.
- Remain under the user’s control.
- Must not be sent to the server.
- Must not be stored in PostgreSQL.
- Must not be committed to source control.

### Transaction Verification

The server should verify:

- Transaction signature.
- Public key.
- Sender address.
- Transaction amount.
- Recipient address.
- Transaction structure.

### Database Security

The application should:

- Use parameterized SQL.
- Keep credentials in environment variables.
- Never commit `.env`.
- Restrict database permissions.
- Use a separate database for tests.
- Avoid exposing database errors directly to clients.

### Input Validation

API inputs should validate:

- Required fields.
- Address format.
- Amount format.
- Signature presence.
- Public key presence.
- Transaction status.
- Numeric ranges.

## 8. Error Handling

Errors should be handled at the layer where they occur.

### API Layer

Converts failures into HTTP responses:

```text
400 - Invalid request
404 - Resource not found
409 - Duplicate or conflicting resource
500 - Unexpected server error
```

### Service Layer

Reports business rule failures such as:

- Invalid signature.
- Insufficient balance.
- Invalid transaction.
- Invalid chain state.

### Repository Layer

Adds database operation context, such as:

```text
Repository operation failed: creating block
Repository operation failed: listing pending transactions
```

The original database error should remain available as the error cause for debugging.

## 9. Testing Strategy

### Unit Tests

Unit tests cover:

- Block creation.
- Transaction validation.
- Mining behavior.
- Balance calculations.
- Chain validation.
- Wallet behavior.

### Repository Tests

Repository tests verify:

- Creating and retrieving wallets.
- Creating and retrieving blocks.
- Creating pending transactions.
- Listing pending transactions.
- Attaching transactions to blocks.
- Confirming transactions.
- Preserving transaction order.
- Handling duplicate constraints.
- Handling invalid database operations.

### API Tests

API tests verify:

- HTTP status codes.
- Request validation.
- JSON response structures.
- Transaction submission.
- Mining endpoints.
- Chain and balance endpoints.

### Build Validation

The project should also validate:

```bash
npm test
npm run build:client
npm run db:check
npm run db:migrate
git diff --check
```

## 10. Deployment Model

```text
+------------------+       +------------------+
| Browser Client   | ----> | Express Server   |
+------------------+       +--------+---------+
                                    |
                                    v
                            +---------------+
                            | PostgreSQL    |
                            +---------------+
```

Required deployment configuration includes:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:5432/DATABASE
PORT=3000
```

Production deployments should use:

- TLS for client-server communication.
- Secure environment variables.
- A managed PostgreSQL instance.
- Restricted database access.
- Automated migration execution.
- Application logging.
- Database backups.
- Health checks.

## 11. Current Status

Completed:

- Browser dashboard.
- Browser wallet creation.
- Browser transaction signing.
- Blockchain API endpoints.
- PostgreSQL configuration.
- Database migrations.
- Genesis block migration.
- Database schema validation.

In progress:

- Repository layer.
- Repository integration tests.

Planned:

- Persistent blockchain loading.
- PostgreSQL-backed transaction submission.
- PostgreSQL-backed mining.
- Service and repository transaction coordination.
- Production persistence validation.

## 12. Architectural Principles

The application follows these principles:

1. Keep HTTP handling in the API layer.
2. Keep blockchain rules in `BlockchainService`.
3. Keep SQL inside repositories.
4. Use dependency injection for database access.
5. Use parameterized SQL queries.
6. Preserve transaction order.
7. Keep private keys out of the server and database.
8. Use migrations for schema changes.
9. Test database behavior independently.
10. Preserve the existing API contract during database integration.

## 13. Target Architecture

```text
Browser
  |
  v
Express Routes
  |
  v
BlockchainService
  |
  +--> WalletRepository
  |
  +--> BlockRepository
  |
  +--> TransactionRepository
          |
          v
   PostgreSQL Connection Pool
          |
          v
      PostgreSQL
```

This architecture allows the application to retain its existing blockchain behavior while gaining durable storage, restart recovery, maintainable database access, and a clear separation of responsibilities.
