/* This module is responsible for mapping rows from the database to JavaScript objects. */

/**
 * Convert a database wallet row into an application wallet object.
 *
 * @param {Object} row - PostgreSQL wallet row.
 * @returns {Object} Application wallet object.
 */

function mapWalletRow(row) {
  return {
    id: Number(row.id),
    address: row.address,
    createdAt: row.created_at,
  };
}

/**
 * Convert a database block row into an application block object.
 *
 * @param {Object} row - PostgreSQL block row.
 * @returns {Object} Application block object.
 */
function mapBlockRow(row) {
  return {
    id: Number(row.id),
    index: row.block_index,
    timestamp: normalizeTimestamp(row.timestamp),
    hash: row.hash,
    previousHash: row.previous_hash,
    nonce: Number(row.nonce),
    createdAt: row.created_at,
  };
}

/**
 * Convert a database transaction row into an application transaction object.
 *
 * @param {Object} row - PostgreSQL transaction row.
 * @returns {Object} Application transaction object.
 */
function mapTransactionRow(row) {
  return {
    id: Number(row.id),
    fromAddress: row.from_address,
    toAddress: row.to_address,
    amount: Number(row.amount),
    publicKey: row.public_key,
    signature: row.signature,
    blockId: row.block_id === null ? null : Number(row.block_id),
    transactionPosition:
      row.transaction_position === null
        ? null
        : Number(row.transaction_position),
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Preserve numeric blockchain timestamps while leaving the genesis timestamp
 * as the string used by the original blockchain implementation.
 *
 * @param {string} timestamp - Database timestamp value.
 * @returns {number|string} Normalized timestamp.
 */
function normalizeTimestamp(timestamp) {
  const numericTimestamp = Number(timestamp);

  return Number.isNaN(numericTimestamp) ? timestamp : numericTimestamp;
}

module.exports = {
  mapWalletRow,
  mapBlockRow,
  mapTransactionRow,
};
