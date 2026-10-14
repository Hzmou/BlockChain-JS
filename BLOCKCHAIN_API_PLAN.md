# Blockchain API Integration Plan

## Goal

Expose the existing blockchain functionality through an HTTP API. Keep blockchain rules in `Blockchain` and `BlockchainService`; keep HTTP concerns in the API layer. This plan targets an in-memory prototype, not a production financial system.

## 1. Create the API Branch

```bash
git switch -c feat/blockchain-api
```

Start from an up-to-date `main` branch and keep this PR focused on the backend API. Do not include the web UI or database unless the scope is intentionally expanded.

## 2. Choose and Install an HTTP Framework

Use Express for the first API implementation.

- Install Express.
- Add a server start script in `package.json`.
- Keep the existing `npm test` command working.
- Read the listening port from an environment variable, with a local development default.

## 3. Create the Server and Shared Instances

Create a server entry point, such as `server.js`.

- Construct one `Blockchain` instance when the server starts.
- Construct one `BlockchainService` with that instance.
- Pass the same service instance to every route.
- Configure JSON request parsing and a consistent JSON error response.
- Do not construct a new blockchain per request; it would lose in-memory state between requests.

## 4. Add the Initial Routes

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/api/chain` | Return `BlockchainService.getChain()` |
| `GET` | `/api/chain/validity` | Return the result of `BlockchainService.isChainValid()` |
| `GET` | `/api/balances/:address` | Return the balance for the address |
| `GET` | `/api/transactions/pending` | Return pending transactions |
| `POST` | `/api/transactions` | Submit a signed transaction through the service |
| `POST` | `/api/mining` | Mine pending transactions for the supplied miner address |

Keep route handlers thin: parse the HTTP request, call the service, and format the HTTP response. Do not duplicate signature, balance, mining, or chain-validation rules in route handlers.

## 5. Define Request and Response Shapes

Use JSON consistently. Example transaction request:

```json
{
  "fromAddress": "sender-address",
  "toAddress": "recipient-address",
  "amount": 25,
  "publicKey": "sender-public-key",
  "signature": "transaction-signature"
}
```

Example mining request:

```json
{
  "minerAddress": "miner-address"
}
```

Return clear success responses containing the created transaction, mined block, balance, chain, pending transactions, or validity result as appropriate. Avoid returning private keys.

## 6. Validate Requests and Map Errors

- Reject malformed JSON and missing required fields.
- Require a valid address and positive finite amount for transactions.
- Let `BlockchainService` and the blockchain logic verify signatures and balances.
- Map invalid input to `400`, insufficient funds to an appropriate client error such as `400` or `409`, and unexpected failures to `500`.
- Use a consistent error response shape, such as `{ "error": "message" }`.
- Never accept or persist a user's private key in the API.

## 7. Add API Tests

Use the project's Node test runner and an HTTP test approach suitable for the chosen framework.

- Test each read endpoint and expected response shape.
- Test successful mining and the resulting block.
- Submit a valid wallet-signed transaction and verify it enters pending transactions.
- Verify unsigned and tampered transactions are rejected.
- Verify invalid amounts and insufficient balances return the expected HTTP status and error shape.
- Verify mining without a valid miner address is rejected.
- Ensure tests do not depend on a shared, long-lived blockchain instance; create isolated instances for each test.

## 8. Document Local Use

Update the README with:

- Installation and server start commands.
- Port configuration.
- Available endpoints and sample requests.
- How to run tests.
- The limitation that blockchain state is in memory and resets when the server restarts.
- A reminder that this is a learning prototype, not production-grade financial infrastructure.

## 9. Verify Before Opening the PR

- Run `npm test`.
- Run the server locally and exercise each route.
- Confirm that a signed transfer can be submitted, mined, and observed through the chain and balance endpoints.
- Confirm invalid signatures and malformed requests return errors without crashing the server.
- Check the diff for unrelated changes and secrets.

## PR Acceptance Checklist

- [ ] Server starts with the documented command.
- [ ] The server creates one shared blockchain and service instance.
- [ ] Routes delegate to `BlockchainService` and contain no duplicated blockchain rules.
- [ ] Invalid requests and service errors produce consistent HTTP responses.
- [ ] Private keys are never accepted for storage or included in responses.
- [ ] API tests and the existing test suite pass.
- [ ] README documents endpoints, local setup, and in-memory limitations.
