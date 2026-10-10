const test = require('node:test');
const assert = require('node:assert/strict');

const Blockchain = require('../blockchain/blockchain');
const Transaction = require('../blockchain/Transaction');

test('mints a valid block with a normal transaction and reward transaction', () => {
  const blockchain = new Blockchain();

  blockchain.createTransaction(new Transaction('alice', 'bob', 50));
  blockchain.minePendingTransactions('miner');

  assert.equal(blockchain.chain.length, 2);
  assert.equal(blockchain.pendingTransactions.length, 0);
  assert.equal(blockchain.getBalanceOfAddress('bob'), 50);
  assert.equal(blockchain.getBalanceOfAddress('miner'), 100);
  assert.equal(blockchain.isChainValid(), true);
});

test('accepts reward transactions when validating the chain', () => {
  const blockchain = new Blockchain();

  blockchain.createTransaction(new Transaction('alice', 'bob', 10));
  blockchain.minePendingTransactions('miner');

  assert.equal(blockchain.isChainValid(), true);
});

