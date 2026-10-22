// Cache the HTML elements that the client will update.
const elements = {
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
};

// Wallet addresses are SHA-256 hashes represented as 64 lowercase hex characters.
const addressPattern = /^[0-9a-f]{64}$/;

// Used to identify the most recent balance request.
let balanceRequestId = 0;

// Display a message near the wallet balance form.
function showStatus(message, type = "info") {
  if (!elements.actionStatus) {
    return;
  }

  elements.actionStatus.textContent = message;
  elements.actionStatus.dataset.type = type;
}

// Send a request to the Express API and return its JSON body.
async function requestJson(url) {
  const response = await fetch(url);
  const body = await response.json();

  // The API uses { error: "..." } for failed requests.
  if (!response.ok) {
    throw new Error(body.error || "The request failed.");
  }

  return body;
}

// Render the pending transactions returned by the API.
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

// Render the blockchain blocks returned by the API.
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

// Load the read-only dashboard data from the API.
async function refreshData() {
  elements.apiStatus.textContent = "Loading...";

  try {
    // These requests can run at the same time because they are independent.
    const [chainBody, validityBody, pendingBody] = await Promise.all([
      requestJson("/api/chain"),
      requestJson("/api/chain/validity"),
      requestJson("/api/transactions/pending"),
    ]);

    elements.apiStatus.textContent = "Online";
    elements.chainValidity.textContent = validityBody.valid
      ? "Valid"
      : "Invalid";

    renderChain(chainBody.chain);
    renderPendingTransactions(pendingBody.pendingTransactions);
  } catch (error) {
    elements.apiStatus.textContent = "Unavailable";
    showStatus(error.message, "error");
  }
}

// Refresh the dashboard when the user clicks the refresh button.
elements.refreshButton.addEventListener("click", refreshData);

// Look up a wallet balance when the balance form is submitted.
elements.balanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const address = elements.walletAddress.value.trim();

  if (!addressPattern.test(address)) {
    elements.balance.textContent = "--";
    showStatus("Enter a valid 64-character wallet address.", "error");
    return;
  }

  // Increment the request ID for every new lookup.
  const requestId = ++balanceRequestId;
  showStatus("Loading balance...");

  try {
    const body = await requestJson(`/api/balances/${address}`);

    // Ignore an older response if a newer request was already submitted.
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
});

// Load the dashboard data when the page first opens.
refreshData();