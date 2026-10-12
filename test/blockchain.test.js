const test = require("node:test");
const assert = require("node:assert/strict");

const Blockchain = require("../blockchain/blockchain");
const Wallet = require("../blockchain/wallet");

function createFundedBlockchain(wallet = new Wallet()) {
  const blockchain = new Blockchain();
  blockchain.minePendingTransactions(wallet.address);
  return { blockchain, wallet };
}

test("accepts a funded transaction and validates its mined block", () => {
  const { blockchain, wallet } = createFundedBlockchain();

  blockchain.createTransaction(wallet.createTransaction("bob", 50));
  blockchain.minePendingTransactions("miner");

  assert.equal(blockchain.getBalanceOfAddress("bob"), 50);
  assert.equal(blockchain.getBalanceOfAddress("miner"), 100);
  assert.equal(blockchain.pendingTransactions.length, 0);
  assert.equal(blockchain.isChainValid(), true);
});

test("rejects a transaction with an invalid amount", () => {
  const { blockchain, wallet } = createFundedBlockchain();

  assert.throws(
    () => blockchain.createTransaction(wallet.createTransaction("bob", 0)),
    /amount/
  );
});

test("rejects a transaction when the sender has insufficient funds", () => {
  const wallet = new Wallet();
  const blockchain = new Blockchain();

  assert.throws(
    () => blockchain.createTransaction(wallet.createTransaction("bob", 10)),
    /Insufficient balance/
  );
});

test("includes pending outgoing transactions when checking funds", () => {
  const { blockchain, wallet } = createFundedBlockchain();

  blockchain.createTransaction(wallet.createTransaction("bob", 80));

  assert.throws(
    () => blockchain.createTransaction(wallet.createTransaction("carol", 30)),
    /Insufficient balance/
  );
});

test("rejects a block whose transaction was tampered with", () => {
  const { blockchain, wallet } = createFundedBlockchain();

  blockchain.createTransaction(wallet.createTransaction("bob", 10));
  blockchain.minePendingTransactions("miner");

  blockchain.chain[2].transactions[0].amount = 11;

  assert.equal(blockchain.isChainValid(), false);
});

test("rejects a block linked to the wrong previous hash", () => {
  const blockchain = new Blockchain();
  blockchain.minePendingTransactions("miner");

  const block = blockchain.chain[1];
  block.previousHash = "incorrect-previous-hash";
  block.nonce = 0;
  block.hash = block.calculateHash();
  block.mineBlock(blockchain.difficulty);

  assert.equal(blockchain.isChainValid(), false);
});

test("rejects a chain that does not meet the configured proof-of-work difficulty", () => {
  const blockchain = new Blockchain();
  blockchain.minePendingTransactions("miner");

  blockchain.difficulty = 100;

  assert.equal(blockchain.isChainValid(), false);
});


test("rejects a transaction with an invalid signature even if proof of work is recomputed", () => {
  const { blockchain, wallet } = createFundedBlockchain();

  blockchain.createTransaction(wallet.createTransaction("bob", 10));
  blockchain.minePendingTransactions("miner");

  const block = blockchain.chain[2];
  block.transactions[0].amount = 11;
  block.nonce = 0;
  block.hash = block.calculateHash();
  block.mineBlock(blockchain.difficulty);

  assert.equal(blockchain.isChainValid(), false);
});