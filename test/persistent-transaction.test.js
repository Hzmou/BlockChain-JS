const test = require("node:test");
const assert = require("node:assert/strict");

const Blockchain = require("../blockchain/blockchain");
const Wallet = require("../blockchain/wallet");
const BlockchainService = require("../services/blockchainService");

function createHarness(initialRows = []) {
  const rows = [...initialRows];

  const transactionRepository = {
    async findTransactionsByAddress(address) {
      return rows.filter(
        (transaction) =>
          transaction.fromAddress === address ||
          transaction.toAddress === address,
      );
    },

    async createPendingTransaction(transaction) {
      const stored = {
        ...transaction,
        id: rows.length + 1,
        blockId: null,
        transactionPosition: null,
        status: "pending",
      };

      rows.push(stored);
      return stored;
    },

    async listPendingTransactions() {
      return rows.filter((transaction) => transaction.status === "pending");
    },
  };

  const service = new BlockchainService(new Blockchain(), {
    transactionRepository,
  });

  return { rows, service };
}

test("persists a valid signed transfer as pending", async () => {
  const sender = new Wallet();
  const recipient = new Wallet();
  const { rows, service } = createHarness([
    {
      fromAddress: null,
      toAddress: sender.address,
      amount: 100,
      status: "confirmed",
    },
  ]);

  const signed = sender.createTransaction(recipient.address, 25);
  const result = await service.submitTransaction(signed);
  const pending = await service.getPendingTransactions();

  assert.deepEqual(result, {
    fromAddress: signed.fromAddress,
    toAddress: signed.toAddress,
    amount: 25,
    publicKey: signed.publicKey,
    signature: signed.signature,
  });
  assert.equal(rows.length, 2);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].amount, 25);
});

test("rejects an invalid signature without inserting it", async () => {
  const sender = new Wallet();
  const recipient = new Wallet();
  const { rows, service } = createHarness([
    {
      fromAddress: null,
      toAddress: sender.address,
      amount: 100,
      status: "confirmed",
    },
  ]);

  const tampered = sender.createTransaction(recipient.address, 25);
  tampered.amount = 30;

  await assert.rejects(
    () => service.submitTransaction(tampered),
    /Invalid transaction signature/,
  );

  assert.equal(rows.length, 1);
});

test("rejects a transfer that exceeds confirmed balance", async () => {
  const sender = new Wallet();
  const recipient = new Wallet();
  const { rows, service } = createHarness();

  await assert.rejects(
    () => service.submitTransaction(sender.createTransaction(recipient.address, 1)),
    /Insufficient balance/,
  );

  assert.equal(rows.length, 0);
});

test("subtracts the sender's pending outgoing transfers from available funds", async () => {
  const sender = new Wallet();
  const recipient = new Wallet();
  const { rows, service } = createHarness([
    {
      fromAddress: null,
      toAddress: sender.address,
      amount: 100,
      status: "confirmed",
    },
    {
      fromAddress: sender.address,
      toAddress: recipient.address,
      amount: 80,
      status: "pending",
    },
  ]);

  await assert.rejects(
    () => service.submitTransaction(sender.createTransaction(recipient.address, 30)),
    /Insufficient balance/,
  );

  assert.equal(rows.length, 2);
});

