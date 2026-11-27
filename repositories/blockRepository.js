/*.  Creates, retrieves, and lists blockchain blocks while preserving block order. */

const { createRepositoryError } = require("./repositoryError");
const { mapBlockRow, mapTransactionRow } = require("./rowMappers");

class BlockRepository {
  /**
   * Create a new block repository instance.
   *
   * @param {import("pg").Pool} databasePool - PostgreSQL database connection pool.
   *
   */
  constructor(databasePool) {
    if (!databasePool) {
      throw new Error("Database pool is required");
    }

    this.databasePool = databasePool;
  }

  /**
   * Create a new block in the database.
   * @param {object} block - The block to create.
   * @param {import("pg").Pool | import("pg").PoolClient} [queryable=this.databasePool] - Database client to use.
   * @returns {Promise<Object>} The created block.
   */
  async createBlock(block, queryable = this.databasePool) {
    try {
      const result = await queryable.query(
        `
          INSERT INTO blocks (
            block_index,
            timestamp,
            hash,
            previous_hash,
            nonce
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING
            id,
            block_index,
            timestamp,
            hash,
            previous_hash,
            nonce,
            created_at
        `,
        [
          block.index,
          String(block.timestamp),
          block.hash,
          block.previousHash,
          block.nonce,
        ],
      );

      return mapBlockRow(result.rows[0]);
    } catch (error) {
      throw createRepositoryError("creating block", error);
    }
  }

  /**
   * Find a block by its blockchain index.
   *
   * @param {number} index - Blockchain block index.
   * @returns {Promise<Object|null>} The block or null if not found.
   */

  async findBlockByIndex(index) {
    try {
      const result = await this.databasePool.query(
        `
          SELECT
            id,
            block_index,
            timestamp,
            hash,
            previous_hash,
            nonce,
            created_at
          FROM blocks
          WHERE block_index = $1
        `,
        [index],
      );

      return result.rows[0] ? mapBlockRow(result.rows[0]) : null;
    } catch (error) {
      throw createRepositoryError("finding block by index", error);
    }
  }

  /**
   * Find the latest block in the blockchain.
   * @param {import("pg").Pool | import("pg").PoolClient} [queryable=this.databasePool] - Database client to use.
   * @returns {Promise<Object|null>} The latest block or null if no blocks exist.
   */
  async findLatestBlock(queryable = this.databasePool) {
    try {
      const result = await queryable.query(`
        SELECT
          id,
          block_index,
          timestamp,
          hash,
          previous_hash,
          nonce,
          created_at
        FROM blocks
        ORDER BY block_index DESC
        LIMIT 1
      `);

      return result.rows[0] ? mapBlockRow(result.rows[0]) : null;
    } catch (error) {
      throw createRepositoryError("finding latest block", error);
    }
  }

  /**
   * Return all blocks in blockcahain order.
   *
   * @returns {Promise<object[]>} - Blocks order by block index.
   */

  async listBlocks() {
    try {
      const result = await this.databasePool.query(`
        SELECT
          id,
          block_index,
          timestamp,
          hash,
          previous_hash,
          nonce,
          created_at
        FROM blocks
        ORDER BY block_index ASC
      `);

      return result.rows.map(mapBlockRow);
    } catch (error) {
      throw createRepositoryError("listing blocks", error);
    }
  }

  /**
   * Find transactions belonging to a block in their original order.
   *
   * @param {number} blockId - Database block ID.
   * @returns {Promise<Object[]>} Ordered block transactions.
   */
  async findBlockTransactions(blockId) {
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
          WHERE block_id = $1
          ORDER BY transaction_position ASC NULLS LAST, id ASC
        `,
        [blockId],
      );

      return result.rows.map(mapTransactionRow);
    } catch (error) {
      throw createRepositoryError("finding block transactions", error);
    }
  }
}

module.exports = BlockRepository;
module.exports.BlockRepository = BlockRepository;
