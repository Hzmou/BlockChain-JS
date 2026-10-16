/**
 * Configures and starts the Express API server for the blockchain application.
 * Creates a shared BlockchainService-backed app; API endpoints will be added
 * here for transactions, mining, balances, and chain validation.
 */

const express = require("express");
const Blockchain = require("./blockchain/blockchain");
const BlockchainService = require("./services/blockchainService");

function createApp(service) {
  if (!service) {
    throw new Error("A blockchain service is required.");
  }

  const app = express();

  // Parse JSON request bodies before API routes.
  app.use(express.json());

  // implementation of the API routes for the blockchain application.

  // function to create a consistent error object for API responses, with a message and status code.
  function apiError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
  }
 

  // helper function to validate if a given address is a valid hexadecimal
  //  string of length 64 (representing a blockchain address).
  function isValidAddress(address) {
    return typeof address === "string" && /^[0-9a-f]{64}$/.test(address);
  }
   

  const blockchainErrorStatuses = new Map([
    ["A transaction is required.", 400],
    ["A valid sender address is required.", 400],
    ["A valid recipient address is required.", 400],
    ["A valid transaction amount is required.", 400],
    ["A valid signature is required for real wallet transfers.", 400],
    ["Invalid transaction signature.", 400],
    ["Insufficient balance.", 409],
  ]);

  function withApiErrors(handler) {
    return (request, response, next) => {
      try {
        handler(request, response);
      } catch (error) {
        if (!error.status && blockchainErrorStatuses.has(error.message)) {
          error.status = blockchainErrorStatuses.get(error.message);
        }

        next(error);
      }
    };
  }

  // API route to submit a new transaction to the blockchain.
  app.get(
    "/api/chain",
    withApiErrors((request, response) => {
      response.json({ chain: service.getChain() });
    }),
  );

  // API route to check the validity of the blockchain.
  app.get(
    "/api/chain/validity",
    withApiErrors((request, response) => {
      response.json({ valid: service.isChainValid() });
    }),
  );

  /* API route to check the balance of a specific address in the blockchain.*/
  app.get(
    "/api/balances/:address",
    withApiErrors((request, response) => {
      const address = request.params.address.trim();

      if (!isValidAddress(address)) {
        throw apiError("A valid address is required.", 400);
      }

      response.json({ address, balance: service.getBalance(address) });
    }),
  );

  // API route to submit a new transaction to the blockchain.

  /* it checks if the request body contains a valid transaction object,
    and if so, it submits the transaction to the blockchain service and 
    returns a success response. If the transaction is invalid, it throws
     an error with an appropriate status code. */

  app.post(
    "/api/transactions",
    withApiErrors((request, response) => {
      const body = request.body;

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw apiError("A valid transaction object is required.", 400);
      }

      const { fromAddress, toAddress, amount, publicKey, signature } = body;

      if (
        !isValidAddress(fromAddress) ||
        !isValidAddress(toAddress) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        typeof publicKey !== "string" ||
        !publicKey.trim() ||
        typeof signature !== "string" ||
        !signature.trim()
      ) {
        throw apiError("A valid signed transaction is required.", 400);
      }

      // Pass only transaction fields; never echo unrelated input such as a private key.

      const transaction = {
        fromAddress,
        toAddress,
        amount,
        publicKey,
        signature,
      };

      service.submitTransaction(transaction);
      response
        .status(201)
        .json({
          message: "Transaction submitted successfully.",
          transaction,
        });
    }),
  );

  // API route to mine a new block and add it to the blockchain.
  app.post(
    "/api/mining",
    withApiErrors((request, response) => {
      const minerAddress = request.body?.minerAddress;

      if (!isValidAddress(minerAddress)) {
        throw apiError("A valid miner address is required.", 400);
      }

      const block = service.mineBlock(minerAddress);
      response.status(201).json({
        message: "Block mined successfully.",
        block,
      });
    }),
  );

  // API route to get the list of pending transactions in the blockchain.
  app.get(
    "/api/transactions/pending",
    withApiErrors((request, response) => {
      response.json({ pendingTransactions: service.getPendingTransactions() });
    }),
  );

  // Return a consistent JSON response for unknown routes.
  app.use((request, response) => {
    response.status(404).json({ error: "Not found" });
  });

  // Convert parsing and other errors into JSON responses.
  app.use((error, request, response, next) => {
    if (response.headersSent) {
      return next(error);
    }

    const statusCode =
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status < 500
        ? error.status
        : 500;

    if (statusCode >= 500) {
      console.error(error);
    }

    response.status(statusCode).json({
      error: statusCode < 500 ? error.message : "Internal server error",
    });
  });

  return app;
}

// create a shared BlockchainService instance for the app.

const blockchain = new Blockchain();
const blockchainService = new BlockchainService(blockchain);
const app = createApp(blockchainService);

// start the server only when this file is run directly, not when imported for testing.

if (require.main == module) {
  const port = Number(process.env.PORT || 3000);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(
      `Invalid port number , post must be a valid port number: ${process.env.PORT}`,
    );
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Blockchain API listening on port ${port}`);
  });
}

module.exports = { app, createApp };
