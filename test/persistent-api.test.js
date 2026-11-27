const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { Pool } = require("pg");

const { createApp } = require("../server");
const BlockRepository = require("../repositories/blockRepository");
const TransactionRepository = require("../repositories/transactionRepository");
const BlockchainService = require("../services/blockchainService");
const {
  loadPersistedBlockchain,
} = require("../services/persistentBlockchainLoader");
const {
  createBrowserSignedTransaction,
} = require("./helpers/browser-wallet");

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test(
  "persistent API supports dashboard reads, transaction submission, and mining",
  {
    skip:
      !testDatabaseUrl &&
      "Set TEST_DATABASE_URL to use a dedicated migrated test database.",
  },
  async () => {
    if (process.env.DATABASE_URL) {
      const testDatabase = new URL(testDatabaseUrl);
      const applicationDatabase = new URL(process.env.DATABASE_URL);

      assert.notEqual(
        `${testDatabase.host}${testDatabase.pathname}`,
        `${applicationDatabase.host}${applicationDatabase.pathname}`,
        "TEST_DATABASE_URL must point to a database separate from DATABASE_URL.",
      );
    }

    const databasePool = new Pool({ connectionString: testDatabaseUrl });
    const blockRepository = new BlockRepository(databasePool);
    const transactionRepository = new TransactionRepository(databasePool);
    const addresses = [];
    let server;
    let databaseReadyForTest = false;

    try {
      const initialBlocks = await blockRepository.listBlocks();
      const initialPendingTransactions =
        await transactionRepository.listPendingTransactions();

      assert.deepEqual(
        initialBlocks.map((block) => block.index),
        [0],
        "Use a dedicated migrated test database containing only the genesis block.",
      );
      assert.equal(
        initialPendingTransactions.length,
        0,
        "The dedicated test database must not contain pending transactions.",
      );
      databaseReadyForTest = true;

      const blockchain = await loadPersistedBlockchain(
        blockRepository,
        transactionRepository,
      );
      const service = new BlockchainService(blockchain, {
        databasePool,
        blockRepository,
        transactionRepository,
      });

      server = createApp(service).listen(0);
      await once(server, "listening");
      const baseUrl = `http://127.0.0.1:${server.address().port}`;

      const initialChainResponse = await fetch(`${baseUrl}/api/chain`);
      const initialChain = await initialChainResponse.json();
      assert.equal(initialChainResponse.status, 200);
      assert.equal(initialChain.chain.length, 1);

      const validityResponse = await fetch(
        `${baseUrl}/api/chain/validity`,
      );
      assert.deepEqual(await validityResponse.json(), { valid: true });

      const recipientAddress = crypto.randomBytes(32).toString("hex");
      const transaction = await createBrowserSignedTransaction(
        recipientAddress,
        25,
      );
      addresses.push(transaction.fromAddress, recipientAddress);

      const initialBalanceResponse = await fetch(
        `${baseUrl}/api/balances/${transaction.fromAddress}`,
      );
      assert.deepEqual(await initialBalanceResponse.json(), {
        address: transaction.fromAddress,
        balance: 0,
      });

      const rewardResponse = await fetch(`${baseUrl}/api/mining`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minerAddress: transaction.fromAddress }),
      });
      const rewardBody = await rewardResponse.json();
      assert.equal(rewardResponse.status, 201);
      assert.equal(rewardBody.block.index, 1);

      const fundedBalanceResponse = await fetch(
        `${baseUrl}/api/balances/${transaction.fromAddress}`,
      );
      assert.equal((await fundedBalanceResponse.json()).balance, 100);

      const transactionResponse = await fetch(`${baseUrl}/api/transactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...transaction,
          privateKey: "must-not-be-returned",
        }),
      });
      const transactionBody = await transactionResponse.json();
      assert.equal(transactionResponse.status, 201);
      assert.deepEqual(transactionBody.transaction, transaction);
      assert.equal(Object.hasOwn(transactionBody.transaction, "privateKey"), false);
      assert.equal(
        JSON.stringify(transactionBody).includes("must-not-be-returned"),
        false,
      );

      const pendingResponse = await fetch(
        `${baseUrl}/api/transactions/pending`,
      );
      const pendingBody = await pendingResponse.json();
      assert.equal(pendingResponse.status, 200);
      assert.deepEqual(pendingBody.pendingTransactions, [transaction]);

      const minerAddress = crypto.randomBytes(32).toString("hex");
      addresses.push(minerAddress);
      const miningResponse = await fetch(`${baseUrl}/api/mining`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minerAddress }),
      });
      const miningBody = await miningResponse.json();
      assert.equal(miningResponse.status, 201);
      assert.equal(miningBody.block.index, 2);
      assert.equal(miningBody.block.transactions.length, 2);
      assert.equal(miningBody.block.transactions[0].toAddress, recipientAddress);
      assert.equal(miningBody.block.transactions[1].toAddress, minerAddress);

      const [chainResponse, finalValidityResponse, finalPendingResponse] =
        await Promise.all([
          fetch(`${baseUrl}/api/chain`),
          fetch(`${baseUrl}/api/chain/validity`),
          fetch(`${baseUrl}/api/transactions/pending`),
        ]);
      const [chainBody, finalValidity, finalPending] = await Promise.all([
        chainResponse.json(),
        finalValidityResponse.json(),
        finalPendingResponse.json(),
      ]);
      assert.equal(chainResponse.status, 200);
      assert.equal(chainBody.chain.length, 3);
      assert.deepEqual(finalValidity, { valid: true });
      assert.deepEqual(finalPending, { pendingTransactions: [] });

      const [senderBalance, recipientBalance, minerBalance] = await Promise.all(
        [transaction.fromAddress, recipientAddress, minerAddress].map(
          async (address) => {
            const response = await fetch(`${baseUrl}/api/balances/${address}`);
            assert.equal(response.status, 200);
            return (await response.json()).balance;
          },
        ),
      );
      assert.equal(senderBalance, 75);
      assert.equal(recipientBalance, 25);
      assert.equal(minerBalance, 100);
    } finally {
      try {
        if (server) {
          await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          });
        }

        if (databaseReadyForTest) {
          await databasePool.query(
            `
              DELETE FROM transactions
              WHERE from_address = ANY($1::VARCHAR[])
                 OR to_address = ANY($1::VARCHAR[])
                 OR block_id IN (
                   SELECT id FROM blocks WHERE block_index > 0
                 )
            `,
            [addresses],
          );
          await databasePool.query(
            "DELETE FROM blocks WHERE block_index > 0",
          );
        }
      } finally {
        await databasePool.end();
      }
    }
  },
);
