const test = require('node:test');
const assert = require('node:assert/strict');

const Blockchain = require('../blockchain/blockchain');
const Wallet = require('../blockchain/wallet');

test('mints a valid block with a normal transaction and reward transaction', () => {
  const blockchain = new Blockchain();
  const sender = new Wallet();
  const recipient = new Wallet();
  const miner = new Wallet();

  blockchain.minePendingTransactions(sender.address);
  blockchain.createTransaction(sender.createTransaction(recipient.address, 50));
  blockchain.minePendingTransactions(miner.address);

  assert.equal(blockchain.chain.length, 3);
  assert.equal(blockchain.pendingTransactions.length, 0);
  assert.equal(blockchain.getBalanceOfAddress(sender.address), 50);
  assert.equal(blockchain.getBalanceOfAddress(recipient.address), 50);
  assert.equal(blockchain.getBalanceOfAddress(miner.address), 100);
  assert.equal(blockchain.isChainValid(), true);
});

test('accepts reward transactions when validating the chain', () => {
  const blockchain = new Blockchain();
  const miner = new Wallet();

  blockchain.minePendingTransactions(miner.address);

  assert.equal(blockchain.getLatestBlock().transactions.length, 1);
  assert.equal(
    blockchain.getBalanceOfAddress(miner.address),
    blockchain.miningReward,
  );
  assert.equal(blockchain.isChainValid(), true);
});
