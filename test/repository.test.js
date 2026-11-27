const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  closeDatabaseConnection,
  createDatabasePool,
} = require("../config/database");
const BlockRepository = require("../repositories/blockRepository");
const TransactionRepository = require("../repositories/transactionRepository");
const WalletRepository = require("../repositories/walletRepository");

const databasePool = process.env.DATABASE_URL
  ? createDatabasePool()
  : null;

const walletRepository = databasePool
  ? new WalletRepository(databasePool)
  : null;

const blockRepository = databasePool
  ? new BlockRepository(databasePool)
  : null;

const transactionRepository = databasePool
  ? new TransactionRepository(databasePool)
  : null;

function address() {
  return crypto.randomBytes(32).toString("hex");
}

test(
  "repositories create and read wallets, blocks, and transactions",
  { skip: !databasePool },
  async () => {
    const senderAddress = address();
    const recipientAddress = address();
    const blockHash = crypto.randomBytes(32).toString("hex");

    let wallet;
    let block;
    let pendingTransaction;

    try {
      wallet = await walletRepository.createWallet(senderAddress);

      assert.equal(wallet.address, senderAddress);
      assert.equal(
        (await walletRepository.findWalletByAddress(senderAddress)).address,
        senderAddress,
      );

      await assert.rejects(
        () => walletRepository.createWallet(senderAddress),
        (error) =>
          error.message.includes("Repository operation failed") &&
          error.cause?.code === "23505",
      );

      const latestBlock = await blockRepository.findLatestBlock();
      const nextBlockIndex = latestBlock ? latestBlock.index + 1 : 0;

      block = await blockRepository.createBlock({
        index: nextBlockIndex,
        timestamp: Date.now(),
        hash: blockHash,
        previousHash: "0",
        nonce: 0,
      });

      assert.equal(block.hash, blockHash);

      await assert.rejects(
        () =>
          blockRepository.createBlock({
            index: nextBlockIndex,
            timestamp: Date.now(),
            hash: blockHash,
            previousHash: "0",
            nonce: 0,
          }),
        (error) =>
          error.message.includes("Repository operation failed") &&
          error.cause?.code === "23505",
      );

      pendingTransaction =
        await transactionRepository.createPendingTransaction({
          fromAddress: senderAddress,
          toAddress: recipientAddress,
          amount: 25,
          publicKey: "test-public-key",
          signature: "test-signature",
        });

      const pendingTransactions =
        await transactionRepository.listPendingTransactions();

      assert.equal(
        pendingTransactions.some(
          (transaction) => transaction.id === pendingTransaction.id,
        ),
        true,
      );

      await transactionRepository.attachTransactionsToBlock(
        [pendingTransaction.id],
        block.id,
      );

      const confirmedTransactions =
        await transactionRepository.markTransactionsConfirmed(
          [pendingTransaction.id],
          block.id,
        );

      assert.equal(confirmedTransactions[0].status, "confirmed");
      assert.equal(confirmedTransactions[0].blockId, block.id);

      const blockTransactions =
        await blockRepository.findBlockTransactions(block.id);

      assert.equal(blockTransactions.length, 1);
      assert.equal(blockTransactions[0].transactionPosition, 0);

      const blocks = await blockRepository.listBlocks();

      for (let index = 1; index < blocks.length; index += 1) {
        assert.ok(
          blocks[index].index > blocks[index - 1].index,
          "Blocks must be returned in ascending block index order",
        );
      }
    } finally {
      if (databasePool) {
        await databasePool.query(
          "DELETE FROM transactions WHERE id = $1",
          [pendingTransaction?.id ?? -1],
        );
        await databasePool.query("DELETE FROM blocks WHERE id = $1", [
          block?.id ?? -1,
        ]);
        await databasePool.query(
          "DELETE FROM wallets WHERE address = $1",
          [senderAddress],
        );
      }
    }
  },
);

test.after(async () => {
  if (databasePool) {
    await closeDatabaseConnection(databasePool);
  }
});

