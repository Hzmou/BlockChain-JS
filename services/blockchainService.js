/* Service for blockchain operations and persistent transaction submission. */

const Wallet = require("../blockchain/wallet");

/**
 * Return the public transaction fields used in API responses.
 *
 * @param {Object} transaction - Transaction from the service or repository.
 * @returns {Object} A transaction without database metadata or private data.
 */
function toApiTransaction(transaction) {
  return {
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    amount: Number(transaction.amount),
    publicKey: transaction.publicKey,
    signature: transaction.signature,
  };
}

/**
 * Validate transaction fields, database precision, and the sender signature.
 *
 * @param {Object} transaction - Signed transaction to validate.
 * @throws {Error} If the transaction is malformed or its signature is invalid.
 */
function validateSignedTransaction(transaction) {
  if (!transaction || typeof transaction !== "object") {
    throw new Error("A transaction is required.");
  }

  if (
    typeof transaction.fromAddress !== "string" ||
    !transaction.fromAddress.trim()
  ) {
    throw new Error("A valid sender address is required.");
  }

  if (
    typeof transaction.toAddress !== "string" ||
    !transaction.toAddress.trim()
  ) {
    throw new Error("A valid recipient address is required.");
  }

  if (
    !Number.isFinite(transaction.amount) ||
    transaction.amount <= 0 ||
    transaction.amount >= 1_000_000_000_000
  ) {
    throw new Error("A valid transaction amount is required.");
  }

  if (Number(transaction.amount.toFixed(8)) !== transaction.amount) {
    throw new Error("Transaction amount supports at most 8 decimal places.");
  }

  if (
    typeof transaction.publicKey !== "string" ||
    typeof transaction.signature !== "string"
  ) {
    throw new Error(
      "A valid signature is required for real wallet transfers.",
    );
  }

  if (!Wallet.verifyTransaction(transaction)) {
    throw new Error("Invalid transaction signature.");
  }
}

class BlockchainService {
  /**
   * Create a blockchain service with optional transaction persistence.
   *
   * @param {Object} blockchain - Blockchain instance providing in-memory operations.
   * @param {{ transactionRepository?: Object|null }} [options={}] - Persistence dependencies.
   */
  constructor(blockchain, { transactionRepository = null } = {}) {
    if (!blockchain) {
      throw new Error("A blockchain instance is required.");
    }

    this.blockchain = blockchain;
    this.transactionRepository = transactionRepository;
  }

  /**
   * Submit a transaction through the in-memory blockchain or persistent store.
   *
   * @param {Object} transaction - Transaction to submit.
   * @returns {Object|Promise<Object>} The accepted transaction.
   */
  submitTransaction(transaction) {
    if (!this.transactionRepository) {
      this.blockchain.createTransaction(transaction);
      return transaction;
    }

    return this.submitPersistentTransaction(transaction);
  }

  /**
   * Verify a signed transaction against persisted balances and store it as pending.
   *
   * @param {Object} transaction - Signed transaction to submit.
   * @returns {Promise<Object>} The accepted transaction for the API response.
   */
  async submitPersistentTransaction(transaction) {
    validateSignedTransaction(transaction);

    const history = await this.transactionRepository.findTransactionsByAddress(
      transaction.fromAddress,
    );

    let confirmedBalance = 0;
    let pendingOutgoing = 0;

    for (const existing of history) {
      const amount = Number(existing.amount);

      if (existing.status === "confirmed") {
        if (existing.fromAddress === transaction.fromAddress) {
          confirmedBalance -= amount;
        }

        if (existing.toAddress === transaction.fromAddress) {
          confirmedBalance += amount;
        }
      } else if (
        existing.status === "pending" &&
        existing.fromAddress === transaction.fromAddress
      ) {
        pendingOutgoing += amount;
      }
    }

    const availableBalance = confirmedBalance - pendingOutgoing;

    if (transaction.amount > availableBalance) {
      throw new Error("Insufficient balance.");
    }

    await this.transactionRepository.createPendingTransaction(transaction);

    return toApiTransaction(transaction);
  }

  /**
   * Mine pending transactions using the in-memory blockchain.
   *
   * Persistent mining is handled in a later integration phase.
   *
   * @param {string} minerAddress - Address to receive the mining reward.
   * @returns {Object} The newly mined block.
   */
  mineBlock(minerAddress) {
    this.blockchain.minePendingTransactions(minerAddress);
    return this.blockchain.getLatestBlock();
  }

  /**
   * Get an address balance from the currently loaded blockchain.
   *
   * @param {string} address - Wallet address.
   * @returns {number} The address balance.
   */
  getBalance(address) {
    return this.blockchain.getBalanceOfAddress(address);
  }

  /**
   * Return a copy of the chain and its transaction arrays.
   *
   * @returns {Object[]} A copy of the blockchain.
   */
  getChain() {
    return this.blockchain.chain.map((block) => ({
      ...block,
      transactions: block.transactions.map((transaction) => ({
        ...transaction,
      })),
    }));
  }

  /**
   * Get pending transactions from PostgreSQL when configured, otherwise use
   * the in-memory pending transaction list.
   *
   * @returns {Object[]|Promise<Object[]>} Pending transactions.
   */
  getPendingTransactions() {
    if (this.transactionRepository) {
      return this.transactionRepository
        .listPendingTransactions()
        .then((transactions) => transactions.map(toApiTransaction));
    }

    return this.blockchain.pendingTransactions.map(toApiTransaction);
  }

  /**
   * Check the validity of the currently loaded blockchain.
   *
   * @returns {boolean} Whether the chain is valid.
   */
  isChainValid() {
    return this.blockchain.isChainValid();
  }
}

module.exports = BlockchainService;
