


# BlockChain-JS

A JavaScript learning project that demonstrates blockchain concepts, wallet-based transaction signing, proof-of-work mining, and a browser dashboard.

## Project Overview

This project currently provides:

- An in-memory blockchain implementation.
- Wallet generation using secp256k1 cryptography.
- Signed transaction creation and verification.
- Proof-of-work block mining.
- An Express HTTP API.
- A browser-based dashboard for inspecting blockchain data.
- Wallet balance lookup.
- Pending transaction display.
- Browser-compatible transaction signing compatibility tests.

This is an educational prototype and is not intended for production financial use.

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
```

## Technology

- JavaScript
- Node.js
- Express
- Node test runner
- Vite
- `@noble/curves`
- `crypto-js`
- secp256k1 elliptic-curve cryptography

## Installation

Install the project dependencies:

```bash
npm install
```

The frontend is bundled with Vite. If Vite is not already listed in
`devDependencies`, install it with:

```bash
npm install --save-dev vite
```

Build the frontend bundle manually with:

```bash
npm run build:client
```

This command creates the browser bundle at `public/build/app.js`.

## Run the Application

Start the Express server:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

The application uses in-memory state. Blockchain data and pending transactions are reset when the server restarts.

## Run Tests

Run the complete test suite:

```bash
npm test
```

Run only the browser wallet compatibility tests:

```bash
node --test test/browser-wallet-compatibility.test.js
```

Run the API tests:

```bash
node --test test/api.test.js
```

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

## Current Limitations

This project is currently an in-memory learning prototype.

Current limitations include:

- Blockchain state is not persisted.
- Pending transactions are reset when the server restarts.
- There is no user account system.
- There is no database integration.
- There is no production wallet custody.
- Wallet recovery and backup are not yet implemented.
- The browser wallet workflow is still being integrated into the dashboard.
- The application does not provide production financial security.

## Planned Future Work

Future work is expected to be handled in separate scopes and branches.

### Wallet Management

Potential wallet-management features include:

- Creating a wallet from the dashboard.
- Displaying the generated wallet address.
- Importing or restoring a wallet.
- Switching between wallets.
- Defining backup and recovery behavior.
- Supporting multiple client-side wallets.

Private keys should remain client-side.

### Database Integration

Potential database integration features include:

- User accounts.
- Wallet metadata.
- Public wallet addresses.
- Public keys.
- Transaction history.
- Blockchain persistence.
- Pending transaction persistence.
- Mining records.
- Application state across server restarts.

Private keys should not be stored in the database by default.

## Branch and Scope Plan

The planned development structure is:

```text
main
  ├── api
  ├── web-ui
  ├── wallet-management
  └── database-integration
```

The current `web-ui` branch should remain focused on the browser dashboard and API integration. Wallet management and database persistence should be planned and implemented as separate future scopes.

## Project Documentation

Additional project plans are available in the `Documentation` directory:

- `Documentation/BLOCKCHAIN_API_PLAN.md`
- `Documentation/WEB_UI_PLAN.md`
- `Documentation/pending-work.md`

These documents describe the current implementation plan, completed milestones, and future work.
