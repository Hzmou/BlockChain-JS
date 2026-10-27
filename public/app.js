/**
 * This will serve as the main entry point for the client-side application,
 * handling user interactions and updating the UI based on the blockchain's state.
 * @author Hamza Zm
 * @version 1.0
 * @license MIT
 * @description This script manages the user interface for interacting with the blockchain,
 * including displaying the blockchain, pending transactions, and wallet balances.
 * It also handles user actions like creating transactions, mining blocks, and validating the blockchain.
 */


import {
  createBrowserWallet,
  createSignedTransaction,
} from "./browser-wallet.js";

// The wallet remains in browser memory and is never rendered or sent to the API.
let browserWallet = null;

// Cache the HTML elements that the client will update.
const elements = {
  createWalletButton: document.querySelector("#create-wallet-button"),
  walletStatus: document.querySelector("#wallet-status"),
  createdWalletAddress: document.querySelector("#created-wallet-address"),
  apiStatus: document.querySelector("#api-status"),
  chainValidity: document.querySelector("#chain-validity"),
  refreshButton: document.querySelector("#refresh-button"),

  balanceForm: document.querySelector("#balance-form"),
  walletAddress: document.querySelector("#wallet-address"),
  balance: document.querySelector("#balance"),
  actionStatus: document.querySelector("#action-status"),

  pendingCount: document.querySelector("#pending-count"),
  pendingTransactions: document.querySelector("#pending-transactions"),

  blockCount: document.querySelector("#block-count"),
  blockchain: document.querySelector("#blockchain"),

  transactionForm: document.querySelector("#transaction-form"),
  recipientAddress: document.querySelector("#recipient-address"),
  transactionAmount: document.querySelector("#transaction-amount"),
  transactionSubmitButton: document.querySelector("#transaction-submit-button"),
  transactionStatus: document.querySelector("#transaction-status"),
};

// Wallet addresses are SHA-256 hashes represented as 64 lowercase hex characters.
const addressPattern = /^[0-9a-f]{64}$/;

// Used to identify the most recent balance request.
let balanceRequestId = 0;

/**
 * Display a status message near the wallet balance form.
 *
 * @param {string} message - The message to display.
 * @param {string} [type="info"] - The status category used by the stylesheet.
 */
function showStatus(message, type = "info") {
  if (!elements.actionStatus) {
    return;
  }

  elements.actionStatus.textContent = message;
  elements.actionStatus.dataset.type = type;
}

/**
 * Send a request to the Express API and return its JSON body.
 *
 * @param {string} url - The API endpoint to request.
 * @returns {Promise<Object>} The decoded JSON response body.
 * @throws {Error} If the request fails or the API returns an error response.
 */
async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();

  // The API uses { error: "..." } for failed requests.
  if (!response.ok) {
    throw new Error(body.error || "The request failed.");
  }

  return body;
}

/**
 * Retrieve the current blockchain.
 *
 * @returns {Promise<Object>} The response containing the blockchain.
 */
async function getChain() {
  return requestJson("/api/chain");
}

/**
 * Retrieve the blockchain validity status.
 *
 * @returns {Promise<Object>} The response containing the validity status.
 */
async function getChainValidity() {
  return requestJson("/api/chain/validity");
}

/**
 * Retrieve the balance for a wallet address.
 *
 * @param {string} address - The wallet address to check.
 * @returns {Promise<Object>} The response containing the wallet balance.
 */
async function getBalance(address) {
  return requestJson(`/api/balances/${address}`);
}

/**
 * Retrieve all pending transactions.
 *
 * @returns {Promise<Object>} The response containing pending transactions.
 */
async function getPendingTransactions() {
  return requestJson("/api/transactions/pending");
}

/**
 * Render the pending transactions returned by the API.
 *
 * @param {Array<Object>} transactions - The pending transactions to display.
 */
function renderPendingTransactions(transactions) {
  elements.pendingCount.textContent = transactions.length;
  elements.pendingTransactions.replaceChildren();

  if (transactions.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "No pending transactions.";
    elements.pendingTransactions.append(emptyMessage);
    return;
  }

  const list = document.createElement("ul");

  for (const transaction of transactions) {
    const item = document.createElement("li");

    // textContent safely renders data without interpreting it as HTML.
    item.textContent =
      `${transaction.fromAddress} -> ` +
      `${transaction.toAddress}: ` +
      `${transaction.amount}`;
    list.append(item);
  }

  elements.pendingTransactions.append(list);
}

/**
 * Render the blockchain blocks returned by the API.
 *
 * @param {Array<Object>} chain - The blocks to display.
 */
function renderChain(chain) {
  elements.blockCount.textContent = chain.length;
  elements.blockchain.replaceChildren();

  if (chain.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "No blocks available in the chain.";
    elements.blockchain.append(emptyMessage);
    return;
  }

  for (const block of chain) {
    const blockElement = document.createElement("article");
    const heading = document.createElement("h3");
    const details = document.createElement("p");

    heading.textContent = `Block #${block.index}`;

    details.textContent =
      `Timestamp: ${block.timestamp} | ` +
      `Hash: ${block.hash} | ` +
      `Previous hash: ${block.previousHash} | ` +
      `Transactions: ${block.transactions.length}`;

    blockElement.append(heading, details);
    elements.blockchain.append(blockElement);
  }
}

/**
 * Load and render the read-only dashboard data from the API.
 *
 * The independent API requests run concurrently so the dashboard can refresh
 * without waiting for each request to finish serially.
 */
async function refreshData() {
  elements.apiStatus.textContent = "Loading...";

  try {
    const address = elements.walletAddress.value.trim();
    const hasValidAddress = addressPattern.test(address);
    const refreshBalanceRequestId = hasValidAddress
      ? ++balanceRequestId
      : balanceRequestId;
    const balanceRequest = hasValidAddress
      ? getBalance(address)
      : Promise.resolve(null);

    const [chainBody, validityBody, pendingBody, balanceBody] =
      await Promise.all([
        getChain(),
        getChainValidity(),
        getPendingTransactions(),
        balanceRequest,
      ]);

    elements.apiStatus.textContent = "Online";
    elements.chainValidity.textContent = validityBody.valid
      ? "Valid"
      : "Invalid";

    renderChain(chainBody.chain);
    renderPendingTransactions(pendingBody.pendingTransactions);

    if (balanceBody && refreshBalanceRequestId === balanceRequestId) {
      elements.balance.textContent = balanceBody.balance;
    }
  } catch (error) {
    elements.apiStatus.textContent = "Unavailable";
    showStatus(error.message, "error");
  }
}

// Refresh the dashboard when the user clicks the refresh button.
elements.refreshButton.addEventListener("click", refreshData);

/**
 * Look up a wallet balance when the balance form is submitted.
 *
 * @param {SubmitEvent} event - The form submission event.
 */
async function handleBalanceSubmit(event) {
  event.preventDefault();

  const address = elements.walletAddress.value.trim();

  if (!addressPattern.test(address)) {
    elements.balance.textContent = "--";
    showStatus("Enter a valid 64-character wallet address.", "error");
    return;
  }

  // Ignore responses from older requests if a newer lookup finishes first.
  const requestId = ++balanceRequestId;
  showStatus("Loading balance...");

  try {
    const body = await getBalance(address);

    if (requestId !== balanceRequestId) {
      return;
    }

    elements.balance.textContent = body.balance;
    showStatus("Balance loaded.", "success");
  } catch (error) {
    if (requestId !== balanceRequestId) {
      return;
    }

    elements.balance.textContent = "--";
    showStatus(error.message, "error");
  }
}

elements.balanceForm.addEventListener("submit", handleBalanceSubmit);

/**
 * Create a browser wallet and display only its public key.
 * The private key remains in the module-scoped browserWallet variable.
 * It is never rendered, logged, persisted, or sent to the API.
 */

function handleCreateWallet() {
  try {
    browserWallet = createBrowserWallet();
    elements.createdWalletAddress.textContent = browserWallet.address;
    elements.walletAddress.value = browserWallet.address;
    elements.walletAddress.readOnly = true;

    elements.walletStatus.textContent =
      "Wallet created in browser memory. The private key is not displayed for security reasons.";

    elements.transactionSubmitButton.disabled = false;
    elements.transactionStatus.textContent =
      "Wallet ready. Enter a recipient and amount.";

    showStatus("Browser wallet created.", "success");
  } catch {
    browserWallet = null;
    elements.createdWalletAddress.textContent = "Not available";
    elements.walletAddress.value = "";
    elements.walletAddress.readOnly = false;
    elements.transactionSubmitButton.disabled = true;

    elements.walletStatus.textContent = "Failed to create browser wallet.";

    showStatus("Failed to create browser wallet.", "error");
  }
}
elements.createWalletButton.addEventListener("click", handleCreateWallet);

/**
 * Submit a signed transaction to the blockchain API.
 *
 * @param {Object} transaction - The signed transaction to submit.
 * @returns {Promise<Object>} The API response.
 */
async function submitTransaction(transaction) {
  return requestJson("/api/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(transaction),
  });
}

/**
 * Handle the submission of a transaction form.
 * @param {Event} event - The form submission event.
 * @returns {Promise<void>} A promise that resolves when the
 * transaction has been processed.
 */

async function handleTransactionSubmit(event) {
  event.preventDefault();

  if (!browserWallet) {
    showStatus(
      "Create a browser wallet before sending a transaction.",
      "error",
    );
    return;
  }

  const toAddress = elements.recipientAddress.value.trim();
  const amount = Number(elements.transactionAmount.value);

  if (!addressPattern.test(toAddress)) {
    elements.transactionStatus.textContent = "Invalid recipient address.";
    showStatus("Invalid recipient address.", "error");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    elements.transactionStatus.textContent = "Invalid transaction amount.";
    showStatus("Invalid transaction amount.", "error");
    return;
  }

  elements.transactionSubmitButton.disabled = true;
  elements.transactionStatus.textContent =
    "Signing and submitting transaction.";

  try {
    const signedTransaction = createSignedTransaction(
      browserWallet,
      toAddress,
      amount,
    );

    await submitTransaction(signedTransaction);
    elements.transactionStatus.textContent =
      "Transaction submitted successfully.";

    elements.recipientAddress.value = "";
    elements.transactionAmount.value = "";

    await refreshData();
  } catch (error) {
    const message = error.message || "Failed to submit transaction.";
    elements.transactionStatus.textContent = message;
    showStatus(message, "error");
  } finally {
    elements.transactionSubmitButton.disabled = false;
  }
}


elements.transactionForm.addEventListener("submit", handleTransactionSubmit);


// Load the dashboard data when the page first opens.
refreshData();
