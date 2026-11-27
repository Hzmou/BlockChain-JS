/*
 * Stores pending transactions, finds transactions by address, attaches
 * transactions to blocks, and marks them as confirmed.
 */

const { createRepositoryError } = require("./repositoryError");
const { mapTransactionRow } = require("./rowMappers");

class TransactionRepository {
  /**
   * Create a new transaction repository instance.
   *
   * @param {import("pg").Pool} databasePool - PostgreSQL database connection pool.
   */
  constructor(databasePool) {
    if (!databasePool) {
      throw new Error("Database pool is required");
    }

    this.databasePool = databasePool;
  }

  /**
   * Store a transaction in the pending state.
   *
   * @param {object} transaction - The transaction to store.
   * @returns {Promise<Object>} The stored transaction.
   */

  async createPendingTransaction(
    transaction,
    queryable = this.databasePool,
  ) {
    if (!transaction) {
      throw new Error("Transaction is required");
    }

    if (!transaction.toAddress) {
      throw new Error("To address is required");
    }

    if (!Number.isFinite(Number(transaction.amount)) || Number(transaction.amount) <= 0) {
      throw new Error("Transaction amount must be a positive number");
    }

    try {
      const result = await queryable.query(
        `
          INSERT INTO transactions (
            from_address,
            to_address,
            amount,
            public_key,
            signature,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'pending')
          RETURNING
            id,
            from_address,
            to_address,
            amount,
            public_key,
            signature,
            block_id,
            transaction_position,
            status,
            created_at
        `,
        [
          transaction.fromAddress,
          transaction.toAddress,
          transaction.amount,
          transaction.publicKey ?? null,
          transaction.signature ?? null,
        ],
      );

      return mapTransactionRow(result.rows[0]);
    } catch (error) {
      throw createRepositoryError("Failed to create transaction", error);
    }
  }

  /**
   * Backward-compatible alias for createPendingTransaction.
   *
   * @param {object} transaction - The transaction to store.
   * @returns {Promise<Object>} The stored transaction.
   */
  async createTransaction(transaction) {
    return this.createPendingTransaction(transaction);
  }

  /**
   * Return all pending transactions stored in the database.
   * @returns {Promise<Object[]>} An array of pending transactions.
   */
  async listPendingTransactions() {
    try {
      const result = await this.databasePool.query(`
        SELECT
          id,
          from_address,
          to_address,
          amount,
          public_key,
          signature,
          block_id,
          transaction_position,
          status,
          created_at
        FROM transactions
        WHERE status = 'pending'
        ORDER BY id ASC
      `);
      return result.rows.map(mapTransactionRow);
    } catch (error) {
      throw createRepositoryError("Failed to list pending transactions", error);
    }
  }

  /**
   * Retrieve and lock pending transactions until the surrounding database
   * transaction completes.
   *
   * @param {import("pg").PoolClient} queryable - Active PostgreSQL client.
   * @returns {Promise<Object[]>} Pending transactions ordered by ID.
   */
  async listPendingTransactionsForUpdate(queryable) {
    try {
      const result = await queryable.query(`
        SELECT
          id,
          from_address,
          to_address,
          amount,
          public_key,
          signature,
          block_id,
          transaction_position,
          status,
          created_at
        FROM transactions
        WHERE status = 'pending'
        ORDER BY id ASC
        FOR UPDATE
      `);

      return result.rows.map(mapTransactionRow);
    } catch (error) {
      throw createRepositoryError(
        "locking pending transactions for mining",
        error,
      );
    }
  }

  /**
   * Find the transactions by the given address.
   * @param {string} address - Wallet address to find.
   * @returns {Promise<Object[]>} An array of matching transactions.
   */

  async findTransactionsByAddress(address) {
    if (!address) {
      throw new Error("Address is required");
    }

    try {
      const result = await this.databasePool.query(
        `
      SELECT
        id,
        from_address,
        to_address,
        amount,
        public_key,
        signature,
        block_id,
        transaction_position,
        status,
        created_at
      FROM transactions
      WHERE from_address = $1 OR to_address = $1
      ORDER BY id ASC
    `,
        [address],
      );

      return result.rows.map(mapTransactionRow);
    } catch (error) {
      throw createRepositoryError(
        "Failed to find transactions by address",
        error,
      );
    }
  }

  /**
   * Attach one or more transactions to a block and preserve their order.
   *
   * @param {number[]} transactionIds - Database transaction IDs.
   * @param {number} blockId - Database block ID.
   * @returns {Promise<Object[]>} Updated transactions.
   */
  async attachTransactionsToBlock(
    transactionIds,
    blockId,
    queryable = this.databasePool,
  ) {
    const validIds = this.validateTransactionIds(transactionIds);

    if (validIds.length === 0) {
      return [];
    }

    if (!Number.isInteger(Number(blockId)) || Number(blockId) <= 0) {
      throw new Error("Block ID must be a positive integer");
    }

    try {
      const result = await queryable.query(
        `
          UPDATE transactions AS transactions
          SET
            block_id = $2,
            transaction_position = (positions.position - 1)::INTEGER
          FROM unnest($1::BIGINT[]) WITH ORDINALITY AS positions(id, position)
          WHERE transactions.id = positions.id
          RETURNING
            transactions.id,
            transactions.from_address,
            transactions.to_address,
            transactions.amount,
            transactions.public_key,
            transactions.signature,
            transactions.block_id,
            transactions.transaction_position,
            transactions.status,
            transactions.created_at
        `,
        [validIds, Number(blockId)],
      );

      return result.rows
        .sort(
          (left, right) =>
            left.transaction_position - right.transaction_position,
        )
        .map(mapTransactionRow);
    } catch (error) {
      throw createRepositoryError(
        "Failed to attach transaction to block",
        error,
      );
    }
  }

  /**
   * Attach a single transaction to a block.
   *
   * @param {number} transactionId - Database transaction ID.
   * @param {number} blockId - Database block ID.
   * @returns {Promise<Object[]>} Updated transactions.
   */
  async attachTransactionToBlock(transactionId, blockId) {
    return this.attachTransactionsToBlock([transactionId], blockId);
  }

  /**
   * Mark one or more transactions as confirmed.
   *
   * @param {number[]} transactionIds - Database transaction IDs.
   * @param {number} blockId - Database block ID.
   * @returns {Promise<Object[]>} Confirmed transactions.
   */
  async markTransactionsConfirmed(
    transactionIds,
    blockId,
    queryable = this.databasePool,
  ) {
    const validIds = this.validateTransactionIds(transactionIds);

    if (validIds.length === 0) {
      return [];
    }

    if (!Number.isInteger(Number(blockId)) || Number(blockId) <= 0) {
      throw new Error("Block ID must be a positive integer");
    }

    try {
      const result = await queryable.query(
        `
          UPDATE transactions
          SET
            block_id = $2,
            status = 'confirmed'
          WHERE id = ANY($1::BIGINT[])
            AND status = 'pending'
          RETURNING
            id,
            from_address,
            to_address,
            amount,
            public_key,
            signature,
            block_id,
            transaction_position,
            status,
            created_at
        `,
        [validIds, Number(blockId)],
      );

      return result.rows.map(mapTransactionRow);
    } catch (error) {
      throw createRepositoryError(
        "Failed to mark transaction as confirmed",
        error,
      );
    }
  }

  /**
   * Mark a single transaction as confirmed.
   *
   * @param {number} transactionId - Database transaction ID.
   * @param {number} blockId - Database block ID.
   * @returns {Promise<Object[]>} Confirmed transactions.
   */
  async markTransactionAsConfirmed(transactionId, blockId) {
    return this.markTransactionsConfirmed([transactionId], blockId);
  }

  /**
   * Return all confirmed transactions.
   *
   * @returns {Promise<Object[]>} Confirmed transactions.
   */
  async listConfirmedTransactions() {
    try {
      const result = await this.databasePool.query(`
        SELECT
          id,
          from_address,
          to_address,
          amount,
          public_key,
          signature,
          block_id,
          transaction_position,
          status,
          created_at
        FROM transactions
        WHERE status = 'confirmed'
        ORDER BY created_at ASC, id ASC
      `);

      return result.rows.map(mapTransactionRow);
    } catch (error) {
      throw createRepositoryError("listing confirmed transactions", error);
    }
  }

  /**
   * Validate and normalize transaction IDs before sending them to PostgreSQL.
   *
   * @param {number[]} transactionIds - Database transaction IDs.
   * @returns {number[]} Normalized positive integer IDs.
   */
  validateTransactionIds(transactionIds) {
    if (!Array.isArray(transactionIds)) {
      throw new Error("Transaction IDs must be an array");
    }

    return transactionIds
      .map((transactionId) => Number(transactionId))
      .filter((transactionId) =>
        Number.isInteger(transactionId) && transactionId > 0
      );
  }
}

module.exports = TransactionRepository;
module.exports.TransactionRepository = TransactionRepository;
