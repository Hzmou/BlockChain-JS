const test = require("node:test");
const assert = require("node:assert/strict");

const Wallet = require("../blockchain/wallet");

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