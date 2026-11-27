/* Service for blockchain operations and persistent transaction submission. */

const Wallet = require("../blockchain/wallet");
const Block = require("../blockchain/block");
const Transaction = require("../blockchain/Transaction");

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
    throw new Error("A valid signature is required for real wallet transfers.");
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
   * @param {{ databasePool?: Object|null, blockRepository?: Object|null, transactionRepository?: Object|null }} [options={}] - Persistence dependencies.
   */
  constructor(
    blockchain,
    {
      databasePool = null,
      blockRepository = null,
      transactionRepository = null,
    } = {},
  ) {
    if (!blockchain) {
      throw new Error("A blockchain instance is required.");
    }

    this.blockchain = blockchain;
    this.databasePool = databasePool;
    this.blockRepository = blockRepository;
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
   * Mine a block and persist it together with its reward and included
   * transactions in one database transaction.
   *
   * @param {string} minerAddress - Address receiving the mining reward.
   * @returns {Promise<Block>} The mined block.
   * @throws {Error} If mining or persistence fails.
   */
  async minePersistentBlock(minerAddress) {
    if (
      typeof minerAddress !== "string" ||
      !/^[0-9a-f]{64}$/.test(minerAddress)
    ) {
      throw new Error(
        "A valid miner address is required for persistent mining.",
      );
    }

    if (
      !this.databasePool ||
      !this.blockRepository ||
      !this.transactionRepository
    ) {
      throw new Error(
        "Database pool and repositories are required for persistent mining.",
      );
    }

    const client = await this.databasePool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      // Serialize mining operations across application instances.
      await client.query("SELECT pg_advisory_xact_lock($1::BIGINT)", [7211001]);

      const latestBlock = await this.blockRepository.findLatestBlock(client);

      if (!latestBlock) {
        throw new Error("No latest block found in the database.");
      }

      const pendingTransactions =
        await this.transactionRepository.listPendingTransactionsForUpdate(
          client,
        );

      const transactions = pendingTransactions.map((transaction) => {
        // Recreate only the fields included in the block hash.
        const result = {
          fromAddress: transaction.fromAddress,
          toAddress: transaction.toAddress,
          amount: Number(transaction.amount),
        };

        if (transaction.publicKey) {
          result.publicKey = transaction.publicKey;
        }

        if (transaction.signature) {
          result.signature = transaction.signature;
        }

        return result;
      });

      // Add the mining reward as the final transaction in the block.
      const rewardTransaction = new Transaction(
        null,
        minerAddress,
        this.blockchain.miningReward,
      );
      transactions.push(rewardTransaction);

      // Build and mine the next block using the latest persisted block.
      const block = new Block(
        latestBlock.index + 1,
        Date.now(),
        transactions,
        latestBlock.hash,
      );

      block.mineBlock(this.blockchain.difficulty);

      const persistedBlock = await this.blockRepository.createBlock(
        block,
        client,
      );

      const persistedReward =
        await this.transactionRepository.createPendingTransaction(
          rewardTransaction,
          client,
        );

      const transactionIds = [
        ...pendingTransactions.map((transaction) => transaction.id),
        persistedReward.id,
      ];

      const attachedTransactions =
        await this.transactionRepository.attachTransactionsToBlock(
          transactionIds,
          persistedBlock.id,
          client,
        );

      if (attachedTransactions.length !== transactionIds.length) {
        throw new Error(
          "Not all transactions were attached to the new block in the database.",
        );
      }

      const confirmedTransactions =
        await this.transactionRepository.markTransactionsConfirmed(
          transactionIds,
          persistedBlock.id,
          client,
        );

      if (confirmedTransactions.length !== transactionIds.length) {
        throw new Error(
          "Not all transactions were marked as confirmed in the database.",
        );
      }

      await client.query("COMMIT");
      transactionOpen = false;

      // Update in-memory state only after the database commit succeeds.
      this.blockchain.chain.push(block);

      return block;
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            "Error during block mining and rollback.",
          );
        }
      }

      throw error;
    } finally {
      client.release();
    }
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
   * Mine in memory when persistence is not configured, otherwise use the
   * atomic PostgreSQL mining workflow.
   *
   * @param {string} minerAddress - Address receiving the mining reward.
   * @returns {Object|Promise<Block>} The newly mined block.
   * @throws {Error} If only some persistence dependencies are configured.
   */
  mineBlock(minerAddress) {
    const persistenceDependencies = [
      this.databasePool,
      this.blockRepository,
      this.transactionRepository,
    ];
    const hasPersistenceDependency = persistenceDependencies.some(Boolean);
    const hasAllPersistenceDependencies =
      persistenceDependencies.every(Boolean);

    if (!hasPersistenceDependency) {
      this.blockchain.minePendingTransactions(minerAddress);
      return this.blockchain.getLatestBlock();
    }

    if (!hasAllPersistenceDependencies) {
      throw new Error(
        "Database pool and both repositories are required for persistent mining.",
      );
    }

    return this.minePersistentBlock(minerAddress);
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
