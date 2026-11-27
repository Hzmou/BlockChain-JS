const test = require("node:test");
const assert = require("node:assert/strict");

const Blockchain = require("../blockchain/blockchain");
const Wallet = require("../blockchain/wallet");
const BlockchainService = require("../services/blockchainService");

function createPendingTransactionRow(id = 10) {
  const sender = new Wallet();
  const recipient = new Wallet();
  const transaction = sender.createTransaction(recipient.address, 25);

  return {
    id,
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    amount: transaction.amount,
    publicKey: transaction.publicKey,
    signature: transaction.signature,
    blockId: null,
    transactionPosition: null,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

function createMiningHarness({
  pendingTransactions = [],
  failAt = null,
  returnPartialConfirmation = false,
} = {}) {
  const blockchain = new Blockchain();
  const genesis = blockchain.getLatestBlock();
  const state = {
    blocks: [
      {
        id: 1,
        index: genesis.index,
        timestamp: genesis.timestamp,
        hash: genesis.hash,
        previousHash: genesis.previousHash,
        nonce: genesis.nonce,
      },
    ],
    transactions: pendingTransactions.map((transaction) => ({ ...transaction })),
    nextBlockId: 2,
    nextTransactionId:
      Math.max(0, ...pendingTransactions.map((transaction) => transaction.id)) +
      1,
  };

  const operations = [];
  let transactionSnapshot = null;
  let connectionCount = 0;
  let releaseCount = 0;

  function cloneState() {
    return {
      blocks: state.blocks.map((block) => ({ ...block })),
      transactions: state.transactions.map((transaction) => ({
        ...transaction,
      })),
      nextBlockId: state.nextBlockId,
      nextTransactionId: state.nextTransactionId,
    };
  }

  const client = {
    async query(sql) {
      const statement = sql.trim();
      operations.push(statement);

      if (statement === "BEGIN") {
        transactionSnapshot = cloneState();
      } else if (statement === "COMMIT") {
        transactionSnapshot = null;
      } else if (statement === "ROLLBACK" && transactionSnapshot) {
        Object.assign(state, transactionSnapshot);
        transactionSnapshot = null;
      }

      return { rows: [] };
    },
    release() {
      releaseCount += 1;
    },
  };

  const databasePool = {
    async connect() {
      connectionCount += 1;
      return client;
    },
  };

  const blockRepository = {
    async findLatestBlock(queryable) {
      assert.equal(queryable, client);
      operations.push("findLatestBlock");
      return { ...state.blocks[state.blocks.length - 1] };
    },

    async createBlock(block, queryable) {
      assert.equal(queryable, client);
      operations.push("createBlock");

      if (failAt === "createBlock") {
        throw new Error("Injected block persistence failure.");
      }

      const persistedBlock = {
        id: state.nextBlockId++,
        index: block.index,
        timestamp: String(block.timestamp),
        hash: block.hash,
        previousHash: block.previousHash,
        nonce: block.nonce,
      };

      state.blocks.push(persistedBlock);
      return { ...persistedBlock };
    },
  };

  const transactionRepository = {
    async listPendingTransactionsForUpdate(queryable) {
      assert.equal(queryable, client);
      operations.push("listPendingTransactionsForUpdate");
      return state.transactions
        .filter((transaction) => transaction.status === "pending")
        .map((transaction) => ({ ...transaction }));
    },

    async createPendingTransaction(transaction, queryable) {
      assert.equal(queryable, client);
      operations.push("createPendingReward");

      if (failAt === "createReward") {
        throw new Error("Injected reward persistence failure.");
      }

      const persistedTransaction = {
        id: state.nextTransactionId++,
        fromAddress: transaction.fromAddress,
        toAddress: transaction.toAddress,
        amount: transaction.amount,
        publicKey: transaction.publicKey ?? null,
        signature: transaction.signature ?? null,
        blockId: null,
        transactionPosition: null,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      state.transactions.push(persistedTransaction);
      return { ...persistedTransaction };
    },

    async attachTransactionsToBlock(transactionIds, blockId, queryable) {
      assert.equal(queryable, client);
      operations.push("attachTransactionsToBlock");

      if (failAt === "attachTransactions") {
        throw new Error("Injected transaction attachment failure.");
      }

      const attached = [];

      for (const [position, id] of transactionIds.entries()) {
        const transaction = state.transactions.find((row) => row.id === id);

        if (transaction) {
          transaction.blockId = blockId;
          transaction.transactionPosition = position;
          attached.push({ ...transaction });
        }
      }

      return attached;
    },

    async markTransactionsConfirmed(transactionIds, blockId, queryable) {
      assert.equal(queryable, client);
      operations.push("markTransactionsConfirmed");

      if (failAt === "confirmTransactions") {
        throw new Error("Injected transaction confirmation failure.");
      }

      const confirmed = [];

      for (const id of transactionIds) {
        const transaction = state.transactions.find(
          (row) => row.id === id && row.status === "pending",
        );

        if (transaction) {
          transaction.blockId = blockId;
          transaction.status = "confirmed";
          confirmed.push({ ...transaction });
        }
      }

      return returnPartialConfirmation ? confirmed.slice(0, -1) : confirmed;
    },

    async listPendingTransactions() {
      return state.transactions
        .filter((transaction) => transaction.status === "pending")
        .map(({ fromAddress, toAddress, amount, publicKey, signature }) => ({
          fromAddress,
          toAddress,
          amount,
          publicKey,
          signature,
        }));
    },
  };

  const service = new BlockchainService(blockchain, {
    databasePool,
    blockRepository,
    transactionRepository,
  });

  return {
    blockchain,
    client,
    databasePool,
    operations,
    service,
    state,
    get connectionCount() {
      return connectionCount;
    },
    get releaseCount() {
      return releaseCount;
    },
  };
}

test("persists a block, confirms pending transactions, and credits the miner", async () => {
  const pendingTransaction = createPendingTransactionRow();
  const harness = createMiningHarness({
    pendingTransactions: [pendingTransaction],
  });
  const miner = new Wallet();

  const minedBlock = await harness.service.mineBlock(miner.address);

  assert.equal(minedBlock.index, 1);
  assert.equal(minedBlock.previousHash, harness.state.blocks[0].hash);
  assert.equal(minedBlock.transactions.length, 2);
  assert.equal(minedBlock.transactions[0].signature, pendingTransaction.signature);
  assert.equal(minedBlock.transactions[1].fromAddress, null);
  assert.equal(minedBlock.transactions[1].toAddress, miner.address);
  assert.equal(minedBlock.transactions[1].amount, harness.blockchain.miningReward);

  assert.equal(harness.state.blocks.length, 2);
  assert.equal(harness.state.blocks[1].hash, minedBlock.hash);
  assert.deepEqual(
    harness.state.transactions.map((transaction) => ({
      id: transaction.id,
      status: transaction.status,
      blockId: transaction.blockId,
      transactionPosition: transaction.transactionPosition,
    })),
    [
      {
        id: pendingTransaction.id,
        status: "confirmed",
        blockId: 2,
        transactionPosition: 0,
      },
      {
        id: pendingTransaction.id + 1,
        status: "confirmed",
        blockId: 2,
        transactionPosition: 1,
      },
    ],
  );
  assert.deepEqual(await harness.service.getPendingTransactions(), []);
  assert.equal(harness.service.getBalance(miner.address), 100);
  assert.equal(harness.blockchain.isChainValid(), true);
  assert.ok(harness.operations.includes("COMMIT"));
  assert.ok(!harness.operations.includes("ROLLBACK"));
  assert.equal(harness.releaseCount, 1);
});

test("mines a reward-only block when there are no pending transactions", async () => {
  const harness = createMiningHarness();
  const miner = new Wallet();

  const minedBlock = await harness.service.mineBlock(miner.address);

  assert.equal(minedBlock.transactions.length, 1);
  assert.equal(minedBlock.transactions[0].fromAddress, null);
  assert.equal(minedBlock.transactions[0].toAddress, miner.address);
  assert.equal(harness.state.transactions.length, 1);
  assert.equal(harness.state.transactions[0].status, "confirmed");
  assert.equal(harness.blockchain.isChainValid(), true);
});

test("rolls back database writes and leaves memory unchanged when confirmation fails", async () => {
  const pendingTransaction = createPendingTransactionRow();
  const harness = createMiningHarness({
    pendingTransactions: [pendingTransaction],
    failAt: "confirmTransactions",
  });
  const initialState = JSON.parse(JSON.stringify(harness.state));
  const miner = new Wallet();

  await assert.rejects(
    () => harness.service.mineBlock(miner.address),
    /Injected transaction confirmation failure/,
  );

  assert.deepEqual(harness.state, initialState);
  assert.equal(harness.blockchain.chain.length, 1);
  assert.ok(harness.operations.includes("ROLLBACK"));
  assert.ok(!harness.operations.includes("COMMIT"));
  assert.equal(harness.releaseCount, 1);
});

test("rolls back when not all included transactions are confirmed", async () => {
  const harness = createMiningHarness({
    returnPartialConfirmation: true,
  });
  const initialState = JSON.parse(JSON.stringify(harness.state));
  const miner = new Wallet();

  await assert.rejects(
    () => harness.service.mineBlock(miner.address),
    /Not all transactions were marked as confirmed/,
  );

  assert.deepEqual(harness.state, initialState);
  assert.equal(harness.blockchain.chain.length, 1);
  assert.ok(harness.operations.includes("ROLLBACK"));
  assert.equal(harness.releaseCount, 1);
});

test("rolls back a partially written block when block persistence fails", async () => {
  const harness = createMiningHarness({ failAt: "createBlock" });
  const initialState = JSON.parse(JSON.stringify(harness.state));
  const miner = new Wallet();

  await assert.rejects(
    () => harness.service.mineBlock(miner.address),
    /Injected block persistence failure/,
  );

  assert.deepEqual(harness.state, initialState);
  assert.equal(harness.blockchain.chain.length, 1);
  assert.ok(harness.operations.includes("ROLLBACK"));
  assert.equal(harness.releaseCount, 1);
});

test("rejects an invalid miner address without opening a database connection", async () => {
  const harness = createMiningHarness();

  await assert.rejects(
    () => harness.service.mineBlock("not-an-address"),
    /valid miner address is required/,
  );

  assert.equal(harness.connectionCount, 0);
});

test("requires all persistence dependencies instead of falling back to memory", () => {
  const service = new BlockchainService(new Blockchain(), {
    databasePool: { connect: async () => {} },
  });

  assert.throws(
    () => service.mineBlock("a".repeat(64)),
    /both repositories are required/,
  );
});

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "persists a mined reward block in PostgreSQL",
  { skip: !testDatabaseUrl && "Set TEST_DATABASE_URL to use a dedicated migrated test database." },
  async () => {
    const { Pool } = require("pg");
    const BlockRepository = require("../repositories/blockRepository");
    const TransactionRepository = require("../repositories/transactionRepository");
    const { loadPersistedBlockchain } = require("../services/persistentBlockchainLoader");

    const databasePool = new Pool({ connectionString: testDatabaseUrl });
    const blockRepository = new BlockRepository(databasePool);
    const transactionRepository = new TransactionRepository(databasePool);
    let minedBlock;

    try {
      const pendingTransactions =
        await transactionRepository.listPendingTransactions();

      assert.equal(
        pendingTransactions.length,
        0,
        "Use an empty, dedicated test database so the test cannot mine unrelated pending transactions.",
      );

      const blockchain = await loadPersistedBlockchain(
        blockRepository,
        transactionRepository,
      );
      const service = new BlockchainService(blockchain, {
        databasePool,
        blockRepository,
        transactionRepository,
      });
      const miner = new Wallet();

      minedBlock = await service.mineBlock(miner.address);

      const persistedBlock = await blockRepository.findBlockByIndex(
        minedBlock.index,
      );
      assert.ok(persistedBlock);
      assert.equal(persistedBlock.hash, minedBlock.hash);

      const persistedTransactions =
        await blockRepository.findBlockTransactions(persistedBlock.id);

      assert.equal(persistedTransactions.length, 1);
      assert.equal(persistedTransactions[0].fromAddress, null);
      assert.equal(persistedTransactions[0].toAddress, miner.address);
      assert.equal(persistedTransactions[0].status, "confirmed");
      assert.equal(blockchain.isChainValid(), true);
    } finally {
      if (minedBlock) {
        const persistedResult = await databasePool.query(
          "SELECT id FROM blocks WHERE hash = $1",
          [minedBlock.hash],
        );
        const persistedBlockId = persistedResult.rows[0]?.id;

        if (persistedBlockId) {
          await databasePool.query(
            "DELETE FROM transactions WHERE block_id = $1",
            [persistedBlockId],
          );
          await databasePool.query("DELETE FROM blocks WHERE id = $1", [
            persistedBlockId,
          ]);
        }
      }

      await databasePool.end();
    }
  },
);
