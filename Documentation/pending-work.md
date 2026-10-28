```md
# Future Work: Wallet Management and Database Integration

The current `web-ui` branch should remain focused on the in-memory browser dashboard and API integration. Wallet management and database persistence should be treated as separate future scopes.

## Recommended Branch Structure

```text
main
  ├── api
  ├── web-ui
  ├── wallet-management
  └── database-integration
```

The exact existing API branch name may differ, but the intended separation is:

- `web-ui`: Browser dashboard and current API integration.
- `wallet-management`: Wallet creation, import, recovery, and wallet switching.
- `database-integration`: Persistent user, wallet metadata, blockchain, and transaction data.

## `web-ui` Scope

The current `web-ui` branch should focus on:

- Displaying blockchain data.
- Checking wallet balances.
- Mining blocks.
- Adding browser-compatible transaction signing.
- Keeping wallet state in browser memory.
- Avoiding user accounts and database persistence.
- Maintaining the current in-memory prototype behavior.

## Future `wallet-management` Scope

A separate `wallet-management` branch should address:

- Creating a wallet from the dashboard.
- Displaying the generated public wallet address.
- Importing or restoring a wallet.
- Signing transactions using the selected wallet.
- Allowing users to switch between wallets.
- Defining wallet backup and recovery behavior.
- Keeping private keys on the client side.
- Ensuring private keys are never sent to the API.
- Supporting multiple browser users through separate client-side wallets.

A multi-user browser experience does not automatically require a database if each wallet exists only in the user’s browser. However, users could lose access after clearing browser storage or changing devices unless a secure recovery strategy is provided.

## Future `database-integration` Scope

A separate `database-integration` branch should address persistent application data, including:

- User accounts.
- Wallet metadata.
- Public wallet addresses.
- Public keys.
- Transaction history.
- Blockchain and block persistence.
- Pending transactions.
- Mining records.
- Application state across server restarts.

Private keys should not be stored in the database by default.

The recommended security boundary is:

```text
Browser:
  - Private key
  - Wallet signing
  - Transaction creation

Server and database:
  - User identity
  - Public wallet address
  - Public key
  - Transaction data
  - Blockchain data
```

If encrypted private-key backup is added later, it should have a separate security design covering:

- Password-based encryption.
- Key derivation.
- Recovery behavior.
- Password loss.
- Threat modeling.
- Secure storage and transmission.
- Protection against unauthorized access.

## Recommended Implementation Order

```text
1. Complete the web-ui branch.
2. Create the wallet-management branch.
3. Define wallet creation, import, and recovery behavior.
4. Implement wallet management and client-side signing.
5. Create the database-integration branch.
6. Add persistent user, wallet metadata, blockchain, and transaction data.
```

## Alternative Order for Persistent Multi-User Accounts

If persistent user accounts are required before wallet management, use:

```text
web-ui
  ↓
database-integration
  ↓
wallet-management
```

This approach should only be used if the application must support server-backed accounts and persistent user data from the beginning.

## Scope Boundary

Database integration should not be added casually to the current `web-ui` branch. It would change the project from an in-memory learning prototype into a persistent multi-user application.

The current `WEB_UI_PLAN.md` describes the application as an in-memory prototype and does not currently include database integration. Therefore, `wallet-management` and `database-integration` are future feature areas that require their own plans, branches, security decisions, and acceptance criteria.
```