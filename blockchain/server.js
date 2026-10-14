
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

  // Add API routes here in step 4, before the fallback handlers.

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
      Number.isInteger(error.status) && error.status >= 400 && error.status < 500
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


