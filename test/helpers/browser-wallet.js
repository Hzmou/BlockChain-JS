const { createHash } = require("node:crypto");

/**
 * Create a transaction using browser-compatible key and signature formats.
 *
 * @param {string} [toAddress="recipient-address"] - The recipient address.
 * @param {number} [amount=10] - The transaction amount.
 * @returns {Promise<Object>} A signed transaction.
 */
async function createBrowserSignedTransaction(
  toAddress = "recipient-address",
  amount = 10,
) {
  const { secp256k1 } = await import("@noble/curves/secp256k1.js");
  const privateKey = secp256k1.utils.randomSecretKey();
  const publicKeyBytes = secp256k1.getPublicKey(privateKey, false);
  const spkiPrefix = Buffer.from(
    "3056301006072a8648ce3d020106052b8104000a034200",
    "hex",
  );
  const publicKeyDer = Buffer.concat([
    spkiPrefix,
    Buffer.from(publicKeyBytes),
  ]);
  const publicKeyPem =
    "-----BEGIN PUBLIC KEY-----\n" +
    publicKeyDer.toString("base64").match(/.{1,64}/g).join("\n") +
    "\n-----END PUBLIC KEY-----\n";
  const transaction = {
    fromAddress: createHash("sha256")
      .update(publicKeyPem)
      .digest("hex"),
    toAddress,
    amount,
    publicKey: publicKeyPem,
  };
  const payload = JSON.stringify({
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    amount: transaction.amount,
  });
  const signatureBytes = secp256k1.sign(Buffer.from(payload), privateKey);
  const signature = secp256k1.Signature.fromBytes(signatureBytes);

  return {
    ...transaction,
    signature: Buffer.from(signature.toBytes("der")).toString("hex"),
  };
}

module.exports = { createBrowserSignedTransaction };
