


const test = require("node:test");
const assert = require("node:assert/strict");

const Blockchain = require("../blockchain/blockchain");
const {
  loadPersistedBlockchain,
} = require("../services/persistentBlockchainLoader");

test("loads the persisted genesis block and pending transactions", async () => {
  const blockchain = new Blockchain();
  const genesis = blockchain.createGenesisBlock();

  const blockRepository = {
    async listBlocks() {
      return [
        {
          id: 1,
          index: 0,
          timestamp: genesis.timestamp,
          hash: genesis.hash,
          previousHash: "0",
          nonce: genesis.nonce,
        },
      ];
    },

    async findBlockTransactions() {
      return [];
    },
  };

  const transactionRepository = {
    async listPendingTransactions() {
      return [
        {
          id: 1,
          fromAddress: "a".repeat(64),
          toAddress: "b".repeat(64),
          amount: 25,
          publicKey: "public-key",
          signature: "signature",
          status: "pending",
          transactionPosition: null,
        },
      ];
    },
  };

  const restored = await loadPersistedBlockchain(
    blockRepository,
    transactionRepository,
  );

  assert.equal(restored.chain.length, 1);
  assert.equal(restored.pendingTransactions.length, 1);
  assert.equal(restored.pendingTransactions[0].amount, 25);
  assert.equal(restored.isChainValid(), true);
});


test("rejects an invalid persisted chain", async () => {
  const blockchain = new Blockchain();
  const genesis = blockchain.createGenesisBlock();

  const blockRepository = {
    async listBlocks() {
      return [
        {
          id: 1,
          index: 0,
          timestamp: genesis.timestamp,
          hash: "invalid-hash",
          previousHash: "0",
          nonce: 0,
        },
      ];
    },

    async findBlockTransactions() {
      return [];
    },
  };

  const transactionRepository = {
    async listPendingTransactions() {
      return [];
    },
  };

  await assert.rejects(
    () =>
      loadPersistedBlockchain(
        blockRepository,
        transactionRepository,
      ),
    /persisted blockchain is invalid/,
  );
});

test("rejects missing or non-sequential persisted blocks", async () => {
  const blockRepository = {
    async listBlocks() {
      return [
        {
          id: 1,
          index: 0,
          timestamp: "01/01/2024",
          hash: "invalid-hash",
          previousHash: "0",
          nonce: 0,
        },
        {
          id: 2,
          index: 2,
          timestamp: "123456",
          hash: "invalid-hash",
          previousHash: "invalid-hash",
          nonce: 1,
        },
      ];
    },

    async findBlockTransactions() {
      return [];
    },
  };

  const transactionRepository = {
    async listPendingTransactions() {
      return [];
    },
  };

  await assert.rejects(
    () =>
      loadPersistedBlockchain(
        blockRepository,
        transactionRepository,
      ),
    /Block index mismatch at position 1/,
  );
});