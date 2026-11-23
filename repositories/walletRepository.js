/* Stores and retrieves public wallet addresses from PostgreSQL. */

const { createRepositoryError } = require("./repositoryError");
const { mapWalletRow } = require("./rowMappers");

class WalletRepository {
  /**
   *
   * Create a new wallet in the database.
   * @param {import("pg").Pool} databasePool - PostgreSQL database connection pool.
   */

  constructor(databasePool) {
    if (!databasePool) {
      throw new Error("Database pool is required");
    }

    this.databasePool = databasePool;
  }

  /**
   * Store a public wallet address.
   *
   * Private keys are intentionally not accepted or stored.
   *
   * @param {string} address - Public wallet address.
   * @returns {Promise<Object>} The created wallet.
   */
  async createWallet(address) {
    try {
      const result = await this.databasePool.query(
        `
          INSERT INTO wallets (address)
          VALUES ($1)
          RETURNING id, address, created_at
        `,
        [address],
      );

      return mapWalletRow(result.rows[0]);
    } catch (error) {
      throw createRepositoryError("createWallet", error);
    }
  }

  /**
   *  find a wallet by its public address.
   * @param {string} address - wallet adress.
   * @returns {Promise<Object|null>} The wallet or null if not found.
   */

  async findWalletByAddress(address) {
    try {
      const result = await this.databasePool.query(
        `
          SELECT id, address, created_at
          FROM wallets
          WHERE address = $1
        `,
        [address],
      );

      return result.rows[0] ? mapWalletRow(result.rows[0]) : null;
    } catch (error) {
      throw createRepositoryError("finding wallet by address", error);
    }
  }

  /**
   * Return all wallets ordered by creation time.
   *
   * @returns {Promise<Object[]>} Stored wallets.
   */

  async listWallets() {
    try {
      const result = await this.databasePool.query(
        `SELECT id, address, created_at
        FROM wallets
        ORDER BY id ASC`,
      );

      return result.rows.map(mapWalletRow);
    } catch (error) {
      throw createRepositoryError("listing wallets", error);
    }
  }
}

module.exports = WalletRepository;
module.exports.WalletRepository = WalletRepository;
