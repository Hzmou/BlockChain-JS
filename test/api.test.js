const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

const Blockchain = require("../blockchain/blockchain");
const Wallet = require("../blockchain/wallet");
const BlockchainService = require("../services/blockchainService");
const { createApp } = require("../server");
const {
  createBrowserSignedTransaction,
} = require("./helpers/browser-wallet");

async function withApi(callback, { fundWallet = false } = {}) {
  const blockchain = new Blockchain();
  const service = new BlockchainService(blockchain);
  const wallet = new Wallet();

  if (fundWallet) {
    service.mineBlock(wallet.address);
  }

  const server = createApp(service).listen(0);
  await once(server, "listening");

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await callback({ baseUrl, blockchain, service, wallet });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function readJson(response) {
  return response.json();
}

test("serves chain, validity, balance, and pending transaction reads", async () => {
  await withApi(async ({ baseUrl, service, wallet }) => {
    service.mineBlock(wallet.address);

    const chainResponse = await fetch(`${baseUrl}/api/chain`);
    const chainBody = await readJson(chainResponse);
    assert.equal(chainResponse.status, 200);
    assert.equal(chainBody.chain.length, 2);

    const validityResponse = await fetch(`${baseUrl}/api/chain/validity`);
    assert.deepEqual(await readJson(validityResponse), { valid: true });

    const balanceResponse = await fetch(
      `${baseUrl}/api/balances/${wallet.address}`,
    );
    assert.deepEqual(await readJson(balanceResponse), {
      address: wallet.address,
      balance: 100,
    });

    const pendingResponse = await fetch(
      `${baseUrl}/api/transactions/pending`,
    );
    assert.deepEqual(await readJson(pendingResponse), {
      pendingTransactions: [],
    });
  });
});

test("submits a signed transaction and does not return extra private-key data", async () => {
  await withApi(async ({ baseUrl, wallet }) => {
    const recipient = new Wallet();
    const signedTransaction = wallet.createTransaction(recipient.address, 25);
    const transaction = {
      fromAddress: signedTransaction.fromAddress,
      toAddress: signedTransaction.toAddress,
      amount: signedTransaction.amount,
      publicKey: signedTransaction.publicKey,
      signature: signedTransaction.signature,
    };

    const response = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...signedTransaction,
        privateKey: wallet.privateKey,
      }),
    });
    const body = await readJson(response);

    assert.equal(response.status, 201);
    assert.equal(body.message, "Transaction submitted successfully.");
    assert.deepEqual(body.transaction, transaction);
    assert.equal(Object.hasOwn(body.transaction, "privateKey"), false);

    const pendingResponse = await fetch(
      `${baseUrl}/api/transactions/pending`,
    );
    assert.deepEqual(await readJson(pendingResponse), {
      pendingTransactions: [transaction],
    });
  }, { fundWallet: true });
});

test("accepts a browser-signed transaction through the API", async () => {
  await withApi(async ({ baseUrl, service }) => {
    const recipientAddress = "b".repeat(64);
    const transaction = await createBrowserSignedTransaction(
      recipientAddress,
      25,
    );
    service.mineBlock(transaction.fromAddress);

    const response = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(transaction),
    });
    const body = await readJson(response);

    assert.equal(response.status, 201);
    assert.equal(body.message, "Transaction submitted successfully.");
    assert.deepEqual(body.transaction, transaction);
    assert.equal(Object.hasOwn(body.transaction, "privateKey"), false);
  });
});

test("mines pending transfers and returns the new block", async () => {
  await withApi(async ({ baseUrl, service, wallet }) => {
    service.mineBlock(wallet.address);
    const recipient = new Wallet();
    const transaction = wallet.createTransaction(recipient.address, 25);

    const submitResponse = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(transaction),
    });
    assert.equal(submitResponse.status, 201);

    const mineResponse = await fetch(`${baseUrl}/api/mining`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minerAddress: recipient.address }),
    });
    const mineBody = await readJson(mineResponse);

    assert.equal(mineResponse.status, 201);
    assert.equal(mineBody.message, "Block mined successfully.");
    assert.equal(mineBody.block.index, 2);
    assert.equal(service.getBalance(recipient.address), 125);
    assert.equal(service.getPendingTransactions().length, 0);
  });
});

test("rejects malformed JSON with a JSON client error", async () => {
  await withApi(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid json",
    });
    const body = await readJson(response);

    assert.equal(response.status, 400);
    assert.equal(typeof body.error, "string");
  });
});

test("rejects invalid address formats and transaction fields", async () => {
  await withApi(async ({ baseUrl, wallet }) => {
    const balanceResponse = await fetch(`${baseUrl}/api/balances/not-an-address`);
    assert.equal(balanceResponse.status, 400);

    const recipient = new Wallet();
    const validTransaction = wallet.createTransaction(recipient.address, 10);
    const invalidTransactions = [
      { ...validTransaction, fromAddress: "invalid-address" },
      { ...validTransaction, toAddress: "invalid-address" },
      { ...validTransaction, amount: 0 },
      { fromAddress: wallet.address, toAddress: recipient.address, amount: 10 },
    ];

    for (const transaction of invalidTransactions) {
      const response = await fetch(`${baseUrl}/api/transactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(transaction),
      });
      assert.equal(response.status, 400);
      assert.equal(typeof (await readJson(response)).error, "string");
    }
  });
});

test("rejects altered signatures and reports insufficient balance", async () => {
  await withApi(async ({ baseUrl, service }) => {
    const unfundedWallet = new Wallet();
    const recipient = new Wallet();
    const transaction = unfundedWallet.createTransaction(recipient.address, 10);
    transaction.amount = 11;

    const invalidSignatureResponse = await fetch(
      `${baseUrl}/api/transactions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(transaction),
      },
    );
    assert.equal(invalidSignatureResponse.status, 400);

    const unfundedTransaction = unfundedWallet.createTransaction(
      recipient.address,
      10,
    );
    const insufficientFundsResponse = await fetch(
      `${baseUrl}/api/transactions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(unfundedTransaction),
      },
    );
    assert.equal(insufficientFundsResponse.status, 409);

    assert.equal(service.getPendingTransactions().length, 0);
  });
});

test("rejects missing or malformed mining requests", async () => {
  await withApi(async ({ baseUrl }) => {
    const missingBodyResponse = await fetch(`${baseUrl}/api/mining`, {
      method: "POST",
    });
    assert.equal(missingBodyResponse.status, 400);

    const invalidAddressResponse = await fetch(`${baseUrl}/api/mining`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ minerAddress: "invalid-address" }),
    });
    assert.equal(invalidAddressResponse.status, 400);
  });
});

test("returns a JSON 404 for an unknown route", async () => {
  await withApi(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/unknown`);

    assert.equal(response.status, 404);
    assert.deepEqual(await readJson(response), { error: "Not found" });
  });
});
