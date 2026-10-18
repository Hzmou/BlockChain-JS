# Blockchain Web UI Plan

## Goal

Build a browser-based interface on the `web-ui` branch that connects to the existing blockchain HTTP API. The first version should make the blockchain state easy to inspect and the core workflows easy to operate while preserving the existing transaction-signature security model.

This is an in-memory learning prototype. The UI should not imply that the application provides production wallet custody, persistence, or financial security.

## 1. Prepare the Web UI Branch

Start from the API work and make sure the branch is current:

```bash
git switch web-ui
git fetch origin
git rebase origin/main
```

Before implementation:

- Confirm the API branch changes are present.
- Run `npm test`.
- Keep API and blockchain tests passing throughout the UI work.
- Keep the PR focused on the browser UI and the API integration it requires.

## 2. Choose the Initial Frontend Shape

Use a small vanilla browser client first because the repository does not currently have a frontend framework, bundler, or frontend test setup.

- Add a dedicated `public/` directory for HTML, CSS, and browser JavaScript.
- Serve the UI from Express at `/` and static assets from `/public`.
- Keep API calls under `/api`; do not duplicate blockchain logic in the browser.
- Avoid adding a frontend build system until the UI needs component composition or a larger application structure.
- Keep the existing CLI entry point and `npm test` behavior working.

If the UI becomes large enough to justify React or another framework, treat that as a separate scope decision rather than mixing it into the first integration.

## 3. Define the First Screen

Create one usable dashboard rather than a marketing page. The first screen should provide:

- A connection/status area showing whether the API is reachable.
- A chain validity indicator.
- A wallet address input and current balance display.
- A pending transaction count and transaction list.
- A recent blockchain view with block index, timestamp, hash, previous hash, and transactions.
- A transaction form for recipient address and amount.
- A mining form for miner address.
- Loading, empty, success, and error states for every operation.
- A refresh action that reloads chain, validity, balance, and pending transactions.

Use a clear visual hierarchy and responsive layout that works on desktop and mobile. Keep dense blockchain data readable through tables or structured rows rather than oversized decorative cards.

## 4. Integrate the Read Endpoints

Create a small browser API client with one function per endpoint:

| Method | Route | UI use |
|---|---|---|
| `GET` | `/api/chain` | Render the chain and latest blocks |
| `GET` | `/api/chain/validity` | Show the current validity state |
| `GET` | `/api/balances/:address` | Show the selected wallet balance |
| `GET` | `/api/transactions/pending` | Show queued transfers |

The client should:

- Check `response.ok` and parse `{ "error": "..." }` consistently.
- Avoid assuming a successful response when the server returns a client error.
- Render server data safely as text, not as unsanitized HTML.
- Cancel or ignore stale balance requests when the address changes rapidly.
- Refresh the relevant views after successful writes.

## 5. Preserve Transaction Signing Security

The current API accepts only a signed transaction containing `fromAddress`, `toAddress`, `amount`, `publicKey`, and `signature`. It must never receive or return a private key.

Before building the send form, resolve browser signing compatibility:

- The existing wallet uses Node `crypto`, PEM public keys, and secp256k1 signatures.
- Browser code cannot directly import the current Node wallet implementation.
- Do not add a private-key field to the API request or send private keys to the server.
- Do not store private keys in the API, query strings, logs, or rendered page content.
- Select and document a browser-compatible signing approach that produces transactions accepted by `Wallet.verifyTransaction`.
- Add a compatibility test using a browser-produced transaction and the existing server verifier before enabling the send action.

A practical implementation option is to use a well-maintained browser cryptography library and add a narrowly scoped compatibility adapter for the existing public-key encoding, address derivation, signing payload, and signature format. Do not replace the server-side verification; the server remains authoritative.

If signing compatibility cannot be completed safely in the first UI slice, ship the read-only dashboard and mining workflow first, and leave the send control disabled with a clear status rather than accepting unsigned data.

## 6. Integrate Write Endpoints

Add API client functions for:

| Method | Route | Request | UI result |
|---|---|---|---|
| `POST` | `/api/transactions` | Signed transaction JSON | Show submission status and refresh pending transactions |
| `POST` | `/api/mining` | `{ "minerAddress": "..." }` | Show the mined block and refresh chain, balance, and pending transactions |

For both forms:

- Disable submission while a request is in progress.
- Validate required fields before sending.
- Display server errors without losing the current page state.
- Prevent duplicate submissions from repeated clicks.
- Never echo a private key in success or error messages.
- Make the mining reward and in-memory reset behavior visible in the UI’s status copy or documentation.

## 7. Add Frontend Structure and Accessibility

Organize the browser code around small responsibilities:

- API client for HTTP requests.
- State and refresh orchestration.
- Rendering functions for chain, transactions, balances, and status.
- Form handlers for submission and mining.
- CSS for responsive layout, states, tables, and readable long hashes.

Accessibility requirements:

- Use semantic headings, labels, buttons, forms, and tables where appropriate.
- Associate every input with a visible label.
- Make status and error messages available to assistive technology.
- Preserve keyboard navigation and visible focus states.
- Do not rely on color alone for validity, loading, or error states.

## 8. Add Tests and Manual Verification

Keep the existing Node API tests and add focused coverage for the UI integration:

- Verify the Express server serves the UI entry point and static assets.
- Verify the API client handles successful responses and `{ error }` responses.
- Verify the dashboard renders empty and populated API data.
- Verify loading, success, and error states for forms.
- Verify successful mining refreshes the displayed chain and pending state.
- Verify transaction signing compatibility before enabling transaction submission.
- Verify no private key appears in requests, responses, DOM output, or logs.
- Verify the UI remains usable at desktop and mobile viewport sizes.

Use a browser test tool only if the project gains a browser test dependency. Otherwise, document a repeatable manual smoke test and keep the API behavior covered by the existing `node:test` suite.

## 9. Document Local Use

Update `README.md` with:

- How to install dependencies.
- How to start the API and web UI with `npm start`.
- The local URL, normally `http://localhost:3000`.
- The dashboard workflows and supported API operations.
- How to run `npm test`.
- The in-memory limitation and reset-on-restart behavior.
- The wallet/signing limitations and the rule that private keys are never sent to the server.

## 10. Verify Before Opening the PR

Run the following checks:

```bash
npm test
npm start
```

With the server running, verify:

- The UI loads at `/`.
- The dashboard can read chain, validity, pending transactions, and a valid balance.
- Invalid addresses and malformed forms show useful errors.
- Mining creates a block and updates the displayed state.
- A signed transfer is accepted only after signing compatibility is verified.
- The API remains responsive after rejected requests.
- No private key is visible in network payloads, page content, logs, or the diff.

Stop the server with `Ctrl+C` after the smoke test.

## PR Acceptance Checklist

- [ ] `web-ui` is based on the current API implementation.
- [ ] The UI is served locally from the existing Express application.
- [ ] Chain, validity, balance, and pending transaction data are displayed.
- [ ] Mining is available through the UI and refreshes the resulting state.
- [ ] Transaction signing is browser-compatible and verified, or the send action remains safely disabled.
- [ ] Private keys are never sent to or stored by the API.
- [ ] Loading, empty, success, error, and responsive states are implemented.
- [ ] Accessibility basics are covered.
- [ ] Existing tests and new UI checks pass.
- [ ] README documents local startup, workflows, tests, and limitations.
- [ ] The PR contains no unrelated changes or secrets.
