/* This is a wallet class for managing cryptographic keys and 
signing transactions , it assigns a unique key pair to each wallet 
and address to each wallet. */

// Use Node's built-in cryptography functions for key generation and signatures.
const {
  createHash,
  generateKeyPairSync,
  sign,
  verify,
} = require("node:crypto");

const Transaction = require("./Transaction");

class Wallet {
  // generate a unique key pair for the wallet and assign an address.

  constructor() {
    // using elliptic curve cryptography (secp256k1)
    // to generate the key pair.
    const { publicKey, privateKey } = generateKeyPairSync("ec", {
      namedCurve: "secp256k1",
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.address = Wallet.addressFromPublicKey(publicKey);
  }

  /* Function to create a new transaction from this wallet to
    a specified address with a given amount. */
  createTransaction(toAddress, amount) {
    // create a new transaction that identifies this wallet as the sender.

    const transaction = new Transaction(this.address, toAddress, amount);

    // attach the public key to the transaction so that it can be verified later.
    transaction.publicKey = this.publicKey;

    // Sign the transaction fields with this wallet's private key.
    transaction.signature = sign(
      "sha256",
      Buffer.from(Wallet.signingPayload(transaction)),
      this.privateKey,
    ).toString("hex");

    return transaction;
  }

  /* Verify signatures on transactions and public keys used to send funds. */

  static verifyTransaction(transaction) {
    // Reject incomplete transactions before trying to verify the signature.

    if (
      !transaction ||
      typeof transaction.fromAddress !== "string" ||
      typeof transaction.toAddress !== "string" ||
      !Number.isFinite(transaction.amount) ||
      typeof transaction.publicKey !== "string" ||
      typeof transaction.signature !== "string"
    ) {
      return false;
    }

    // confirm the public key matches the fromAddress.

    if (
      Wallet.addressFromPublicKey(transaction.publicKey) !==
      transaction.fromAddress
    ) {
      return false;
    }

    // Verify that the transaction fields were signed by the matching private key.

    try {
      return verify(
        "sha256",
        Buffer.from(Wallet.signingPayload(transaction)),
        transaction.publicKey,
        Buffer.from(transaction.signature, "hex"),
      );
    } catch {
      return false;
    }
  }

  //function to derive the wallet address from a given public key.
  static addressFromPublicKey(publicKey) {
    return createHash("sha256").update(publicKey).digest("hex");
  }

  // Function to generate the payload that will be signed for a transaction.
  static signingPayload(transaction) {
    // Serialize only the fields the signature is meant to protect.
    // Keep this consistent wherever transactions are signed or verified.
    return JSON.stringify({
      fromAddress: transaction.fromAddress,
      toAddress: transaction.toAddress,
      amount: transaction.amount,
    });
  }
}


module.exports = Wallet;