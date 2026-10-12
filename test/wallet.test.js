const test = require("node:test");
const assert = require("node:assert/strict");
const Wallet = require("../blockchain/wallet");
const Blockchain = require("../blockchain/blockchain");
const Transaction = require("../blockchain/Transaction");

function createFundedBlockchain() {
  const blockchain = new Blockchain();
  const wallet = new Wallet();
  blockchain.minePendingTransactions(wallet.address);
  return { blockchain, wallet };
}

test("creates wallets with distinct keys and addresses", () => {
  const firstWallet = new Wallet();
  const secondWallet = new Wallet();

  assert.notEqual(firstWallet.address, secondWallet.address);
  assert.notEqual(firstWallet.publicKey, secondWallet.publicKey);
  assert.notEqual(firstWallet.privateKey, secondWallet.privateKey);
});

test("creates a transaction with a verifiable signature", () => {
  const wallet = new Wallet();
  const transaction = wallet.createTransaction("recipient-address", 25);

  assert.equal(transaction.fromAddress, wallet.address);
  assert.equal(transaction.publicKey, wallet.publicKey);
  assert.equal(Wallet.verifyTransaction(transaction), true);
});

test("rejects a transaction whose signed fields were changed", () => {
  const wallet = new Wallet();
  const transaction = wallet.createTransaction("recipient-address", 25);

  transaction.amount = 50;

  assert.equal(Wallet.verifyTransaction(transaction), false);
});

test("rejects a transaction with a mismatched sender address", () => {
  const wallet = new Wallet();
  const transaction = wallet.createTransaction("recipient-address", 25);

  transaction.fromAddress = "another-address";

  assert.equal(Wallet.verifyTransaction(transaction), false);
});

test("rejects incomplete transactions", () => {
  assert.equal(Wallet.verifyTransaction({}), false);
});


test("accepts a funded transaction signed by its wallet", () => {
  const { blockchain, wallet } = createFundedBlockchain();
  const transaction = wallet.createTransaction("bob", 50);

  blockchain.createTransaction(transaction);
  assert.equal(blockchain.pendingTransactions.length, 1);

  blockchain.minePendingTransactions("miner");

  assert.equal(blockchain.getBalanceOfAddress("bob"), 50);
  assert.equal(blockchain.isChainValid(), true);
});

test("rejects an unsigned transaction", () => {
  const { blockchain, wallet } = createFundedBlockchain();
  const transaction = new Transaction(wallet.address, "bob", 10);

  assert.throws(
    () => blockchain.createTransaction(transaction),
    /signature/i
  );
});

test("rejects a transaction whose signed amount was changed", () => {
  const { blockchain, wallet } = createFundedBlockchain();
  const transaction = wallet.createTransaction("bob", 10);
  transaction.amount = 20;

  assert.throws(
    () => blockchain.createTransaction(transaction),
    /signature/i
  );
});

test("adds exactly one mining reward at the end without putting it in pending transactions", () => {
  const blockchain = new Blockchain();

  blockchain.minePendingTransactions("miner");

  const block = blockchain.getLatestBlock();
  const rewards = block.transactions.filter(
    (transaction) => transaction.fromAddress === null
  );

  assert.equal(rewards.length, 1);
  assert.equal(block.transactions.at(-1), rewards[0]);
  assert.equal(blockchain.pendingTransactions.length, 0);
});