/* Loads and reconstructs the blockchain from persisted database records. */

const Block = require("../blockchain/block");
const Blockchain = require("../blockchain/blockchain");

/**
 * Convert a persisted transaction row into the application transaction shape.
 *
 * @param {Object} row - Persisted transaction row.
 * @returns {Object} Blockchain transaction.
 */
function mapTransaction(row) {
  const transaction = {
    fromAddress: row.fromAddress,
    toAddress: row.toAddress,
    amount: row.amount,
  };

  if (row.publicKey) {
    transaction.publicKey = row.publicKey;
  }

  if (row.signature) {
    transaction.signature = row.signature;
  }

  return transaction;
}

/**
 * Load blocks and pending transactions from repositories, rebuild the
 * blockchain objects, and reject an invalid reconstructed chain.
 *
 * @param {Object} blockRepository - Repository used to load persisted blocks.
 * @param {Object} transactionRepository - Repository used to load pending transactions.
 * @returns {Promise<Blockchain>} Reconstructed and validated blockchain.
 * @throws {Error} If repositories are missing or persisted data is invalid.
 */
async function loadPersistedBlockchain(
  blockRepository,
  transactionRepository,
) {
  if (!blockRepository || !transactionRepository) {
    throw new Error(
      "Block and transaction repositories are required to load the persisted blockchain.",
    );
  }

  const blockRows = await blockRepository.listBlocks();
  const blockchain = new Blockchain();

  if (!Array.isArray(blockRows) || blockRows.length === 0) {
    throw new Error("No persisted blockchain blocks were found.");
  }

  const persistedChain = [];

  for (let position = 0; position < blockRows.length; position++) {
    const blockRow = blockRows[position];

    if (blockRow.index !== position) {
      throw new Error(
        `Block index mismatch at position ${position}. Expected index ${position}, but found ${blockRow.index}.`,
      );
    }

    const transactionRows = await blockRepository.findBlockTransactions(
      blockRow.id,
    );

    const orderedTransactions = [...transactionRows].sort(
      (left, right) =>
        (left.transactionPosition ?? Number.MAX_SAFE_INTEGER) -
        (right.transactionPosition ?? Number.MAX_SAFE_INTEGER),
    );

    // Convert ordered database rows into application transaction objects.
    const transactions = orderedTransactions.map(mapTransaction);

    // Create a new block while using the persisted timestamp, transactions,
    // and previous hash.
    const block = new Block(
      blockRow.index,
      blockRow.timestamp,
      transactions,
      blockRow.previousHash,
    );

    // Restore the exact proof-of-work values stored in PostgreSQL.
    block.hash = blockRow.hash;
    block.nonce = blockRow.nonce;

    // Add the reconstructed block to the persisted chain.
    persistedChain.push(block);
  }

  blockchain.chain = persistedChain;

  const pendingRows = await transactionRepository.listPendingTransactions();

  blockchain.pendingTransactions = pendingRows.map(mapTransaction);

  if (!blockchain.isChainValid()) {
    throw new Error(
      "The persisted blockchain is invalid. The chain integrity check failed.",
    );
  }

  return blockchain;
}

module.exports = {
  loadPersistedBlockchain,
};
