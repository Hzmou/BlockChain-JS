/*

   All browser wallet compatibility tests should be added to 
   this file.
**/



// the  first test is a simple secp256k1 signature verification test using noble, to ensure that the noble library is working correctly in the node environment.

const test = require("node:test");
const assert = require("node:assert/strict");
const wallet = require("../blockchain/wallet.js");
const {
  createBrowserSignedTransaction,
} = require("./helpers/browser-wallet");

test("creates and verifies a secp256k1 signature with noble", async () => {
  const { secp256k1 } = await import("@noble/curves/secp256k1.js");
  const privateKey = secp256k1.utils.randomSecretKey();
  const publicKey = secp256k1.getPublicKey(privateKey);

  const message = new TextEncoder().encode("browser wallet test");
  const messageHash = require("node:crypto")
    .createHash("sha256")
    .update(message)
    .digest();

  const signature = secp256k1.sign(messageHash, privateKey);

  assert.equal(secp256k1.verify(signature, messageHash, publicKey), true);
});



// testing that a transaction created in the browser with noble can be verified by the server wallet verifier


test("creates a transaction accepted by the server wallet verifier", async () => {
  const transaction = await createBrowserSignedTransaction();
  assert.equal(wallet.verifyTransaction(transaction), true);
});

test("rejects a browser-signed transaction when the amount changes", async () => {
  const transaction = await createBrowserSignedTransaction();
  transaction.amount = 20;

  assert.equal(wallet.verifyTransaction(transaction), false);
});

test("rejects a browser-signed transaction when the recipient changes", async () => {
  const transaction = await createBrowserSignedTransaction();
  transaction.toAddress = "another-recipient";

  assert.equal(wallet.verifyTransaction(transaction), false);
});

test("rejects a browser-signed transaction when the sender changes", async () => {
  const transaction = await createBrowserSignedTransaction();
  transaction.fromAddress = "another-address";

  assert.equal(wallet.verifyTransaction(transaction), false);
});
