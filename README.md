


# BlockChain-JS

A JavaScript learning project that demonstrates blockchain concepts, wallet-based transaction signing, proof-of-work mining, and a browser dashboard.

## Project Overview

This project currently provides:

- A PostgreSQL-backed blockchain with persisted blocks and transactions.
- Wallet generation using secp256k1 cryptography.
- Signed transaction creation and verification.
- Proof-of-work block mining.
- An Express HTTP API.
- A browser-based dashboard for inspecting blockchain data.
- Wallet balance lookup.
- Pending transaction display.
- Browser-compatible transaction signing compatibility tests.

This is an educational prototype and is not intended for production financial
use. The interactive CLI in `main.js` is in-memory; use the Express server
(`npm start`) for PostgreSQL-backed operation.

## Current Architecture

```text
Blockchain logic
  ├── Wallet generation and transaction signing
  ├── Transaction validation
  ├── Pending transaction management
  ├── Proof-of-work mining
  └── Chain validation

Express API
  ├── Read blockchain data
  ├── Check chain validity
  ├── Check wallet balances
  ├── View pending transactions
  ├── Submit signed transactions
  └── Mine new blocks

Web UI
  ├── Display chain status
  ├── Display blockchain blocks
  ├── Display pending transactions
  ├── Look up wallet balances
  └── Integrate browser-compatible transaction signing

PostgreSQL
  ├── Persist blocks
  ├── Persist pending and confirmed transactions
  └── Seed the genesis block through migrations
```

## Technology

- JavaScript
- Node.js
- Express
- PostgreSQL with the `pg` driver
- Node test runner
- Vite
- `dotenv`
- `@noble/curves`
- `crypto-js`
- secp256k1 elliptic-curve cryptography

## Installation

Install the project dependencies:

```bash
npm install
```

Build the frontend bundle manually with:

```bash
npm run build:client
```

This command creates the browser bundle at `public/build/app.js`.

## PostgreSQL Setup and Management

The Express server requires PostgreSQL. It loads the persisted blockchain on
startup and will not start if the database is unavailable, has not been
migrated, or contains an invalid chain. Schema migrations are run explicitly;
starting the server does not apply migrations automatically.

### 1. Install PostgreSQL

Install PostgreSQL for your operating system using the
[official PostgreSQL downloads](https://www.postgresql.org/download/), then
start the PostgreSQL service. Confirm the command-line client is available:

```bash
psql --version
```

### 2. Create a database

Create a local database named `blockchain` using pgAdmin or the PostgreSQL
command-line tools:

```bash
createdb blockchain
```

If you use a dedicated PostgreSQL role, create it and make it the database
owner:

```bash
createuser --pwprompt blockchain_user
createdb --owner=blockchain_user blockchain
```

The application role needs permission to create and modify tables and records
in this database.

### 3. Configure environment variables

Copy the example file and edit the local copy:

```bash
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to the connection URL for your local database:

```env
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/blockchain
PORT=3000
```

Replace the placeholders with your local PostgreSQL role and password. URL
encode reserved characters in the password. `PORT` is optional and defaults to
`3000`.

Keep real credentials in `.env` or another local secret manager. Do not commit
`.env`, paste credentials into chat, or put real credentials in
`.env.example`; that file should contain placeholders only.

### 4. Check the connection and apply migrations

Check that the configured database is reachable:

```bash
npm run db:check
```

Then create the tables and seed the genesis block:

```bash
npm run db:migrate
```

Migrations are tracked in `schema_migrations`, run in filename order, and can
be run again safely; already-applied migrations are skipped. The genesis block
is inserted by a migration. Run migrations after pulling changes that add a
new migration and before starting the server.

### 5. Start the persistent application

```bash
npm start
```

`npm start` builds the dashboard and starts the PostgreSQL-backed Express
server. Open `http://localhost:3000` (or the port configured by `PORT`).
Blocks and pending/confirmed transactions are written to PostgreSQL as the
application runs and loaded again at server startup. You do not need to run a
migration for each transaction or block; migrations change the schema, while
application operations write runtime data.

### Run database-backed tests

Run the full test suite:

```bash
npm test
```

Repository tests use `DATABASE_URL` when it is configured. Use a local
development database, not production, when running tests.

The persistent mining and API integration tests are opt-in and require a
separate, disposable PostgreSQL database. Create it, set `TEST_DATABASE_URL`
locally, and migrate it before running those tests. It must not be the same
database as `DATABASE_URL`; the persistent API test also requires the test
database to contain only the genesis block and no pending transactions.

To migrate that test database, temporarily set `DATABASE_URL` to its
connection URL and run `npm run db:migrate`; then restore `DATABASE_URL` to
your normal development database. With `TEST_DATABASE_URL` available in
`.env`, preload dotenv when running the integration tests:

```bash
node -r dotenv/config --test test/persistent-mining.test.js
node -r dotenv/config --test test/persistent-api.test.js
```

Run these integration files separately and sequentially. The tests clean up
their own records, but they are intended only for the dedicated test database.

Other useful test and build commands:

```bash
node --test test/api.test.js
node --test test/browser-wallet-compatibility.test.js
npm run build:client
```

### Reset a local development database

**Warning:** resetting permanently deletes all data in the selected database,
including blocks and transactions. Stop the application first, verify the
database name in `DATABASE_URL`, and use this procedure only for a disposable
local development database. Never use it against production or data you need.

For a database named `blockchain`, recreate it and run migrations again:

```bash
dropdb blockchain
createdb blockchain
npm run db:migrate
```

Replace `blockchain` with the actual local database name if it differs. You
can also drop and recreate a local database through pgAdmin, then run
`npm run db:migrate` with `DATABASE_URL` pointing to it. Migrations recreate
the schema and seed the genesis block.

## API Endpoints

### Read Endpoints

```text
GET /api/chain
GET /api/chain/validity
GET /api/balances/:address
GET /api/transactions/pending
```

### Write Endpoints

```text
POST /api/transactions
POST /api/mining
```

Transactions submitted to the API must include:

```json
{
  "fromAddress": "sender-address",
  "toAddress": "recipient-address",
  "amount": 10,
  "publicKey": "sender-public-key",
  "signature": "transaction-signature"
}
```

Private keys must never be sent to the API.

## Browser Wallet Signing

The browser signing work uses `@noble/curves` for secp256k1 compatibility.

The compatibility tests verify that:

- Browser-compatible keys can be generated.
- Browser-compatible signatures can be created.
- The server-side wallet verifier accepts the signed transaction.
- Modified transaction amounts are rejected.
- Modified recipient addresses are rejected.
- Modified sender addresses are rejected.
- Browser-signed transactions are accepted by the API.
- Private keys are not returned by the API.

The private key must remain in browser memory and must never be:

- Sent to the server.
- Included in a URL.
- Logged.
- Rendered in the page.
- Stored by the API.
- Returned in an API response.

## Security and Current Limitations

The blockchain and transaction records are persisted in PostgreSQL, but this
remains an educational prototype and is not production financial software.
There is no user account system or production wallet custody. Wallet recovery
and backup are not implemented.

Private keys remain in browser memory. They must never be sent to the server,
included in URLs, logged, rendered, or stored in PostgreSQL. Browser-created
wallets and their addresses are not registered in PostgreSQL by the dashboard,
and are not recovered automatically after a page reload.

## Project Documentation

Additional project plans are available in the `Documentation` directory:

- `Documentation/BLOCKCHAIN_API_PLAN.md`
- `Documentation/DATABASE_INTEGRATION_PLAN.md`
- `Documentation/WEB_UI_PLAN.md`
- `Documentation/pending-work.md`

These documents describe the implementation plans, completed milestones, and
remaining work.
