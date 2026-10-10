const test = require("node:test");
const assert = require("node:assert/strict");

const Blockchain = require("../blockchain/blockchain");
const Transaction = require("../blockchain/Transaction");

function createFundedBlockchain(address = "alice") {
  const blockchain = new Blockchain();
  blockchain.minePendingTransactions(address);
  return blockchain;
}

test("accepts a funded transaction and validates its mined block", () => {
  const blockchain = createFundedBlockchain();

  blockchain.createTransaction(new Transaction("alice", "bob", 50));
  blockchain.minePendingTransactions("miner");

  assert.equal(blockchain.getBalanceOfAddress("bob"), 50);
  assert.equal(blockchain.getBalanceOfAddress("miner"), 100);
  assert.equal(blockchain.pendingTransactions.length, 0);
  assert.equal(blockchain.isChainValid(), true);
});

test("rejects a transaction with an invalid amount", () => {
  const blockchain = createFundedBlockchain();

  assert.throws(
    () => blockchain.createTransaction(new Transaction("alice", "bob", 0)),
    /amount/
  );
});

test("rejects a transaction when the sender has insufficient funds", () => {
  const blockchain = new Blockchain();

  assert.throws(
    () => blockchain.createTransaction(new Transaction("alice", "bob", 10)),
    /Insufficient balance/
  );
});

test("includes pending outgoing transactions when checking funds", () => {
  const blockchain = createFundedBlockchain();

  blockchain.createTransaction(new Transaction("alice", "bob", 80));

  assert.throws(
    () => blockchain.createTransaction(new Transaction("alice", "carol", 30)),
    /Insufficient balance/
  );
});

test("rejects a block whose transaction was tampered with", () => {
  const blockchain = createFundedBlockchain();

  blockchain.createTransaction(new Transaction("alice", "bob", 10));
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