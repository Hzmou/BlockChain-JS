/**
 * Browser-side wallet module that wraps Noble's secp256k1 support.
 */

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";

const spkiPrefix = new Uint8Array([
  0x30, 0x56, 0x30, 0x10, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a, 0x03, 0x42, 0x00,
]);

/**
 * Convert bytes to a Base64 string in the browser.
 * @param {Uint8Array} bytes - The bytes to convert.
 * @returns {string} - The base 64 encoded string.
 *
 */

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

/**
 * Convert a raw secp256k1 public key to an SPKI PEM public key.
 *
 * @param {Uint8Array} publicKeyBytes - The raw uncompressed public key.
 * @returns {string} The encoded SPKI PEM public key.
 */

function toPublicKeyPem(publicKeyBytes) {
  const der = new Uint8Array(spkiPrefix.length + publicKeyBytes.length);
  der.set(spkiPrefix);
  der.set(publicKeyBytes, spkiPrefix.length);

  const base64 = toBase64(der);
  const lines = base64.match(/.{1,64}/g) ?? [];

  return [
    "-----BEGIN PUBLIC KEY-----",
    ...lines,
    "-----END PUBLIC KEY-----",
    "",
  ].join("\n");
}

/**
 * Create an in-memory browser wallet.
 *
 * @returns {{privateKey: Uint8Array, publicKey: string, address: string}}
 * The browser wallet containing the private key, public key, and address.
 */

export function createBrowserWallet() {
  const privateKey = secp256k1.utils.randomSecretKey();
  const publicKeyBytes = secp256k1.getPublicKey(privateKey, false);
  const publicKey = toPublicKeyPem(publicKeyBytes);

  // The wallet address is the SHA-256 hash of the public key, represented as a 64-character
  // lowercase hex string.
  const address = Array.from(sha256(new TextEncoder().encode(publicKey)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    privateKey,
    publicKey,
    address,
  };
}

/**
 * Create a signed transaction without exposing the private key.
 *
 * @param {{privateKey: Uint8Array, publicKey: string, address: string}} wallet
 *   The wallet containing the private key, public key, and address.
 * @param {string} toAddress - The recipient's wallet address.
 * @param {number} amount - The amount to send.
 * @returns {Object} The signed transaction.
 *
 */

export function createSignedTransaction(wallet, toAddress, amount) {
  const transaction = {
    fromAddress: wallet.address,
    toAddress,
    amount,
    publicKey: wallet.publicKey,
  };

  // Serialize the transaction to a JSON string and encode it as bytes.

  const payload = JSON.stringify({
    fromAddress: transaction.fromAddress,
    toAddress: transaction.toAddress,
    amount: transaction.amount,
  });

  const signatureBytes = secp256k1.sign(
    new TextEncoder().encode(payload),
    wallet.privateKey,
  );

  const signature = secp256k1.Signature.fromBytes(signatureBytes);

  return {
    ...transaction,
    signature: Array.from(signature.toBytes("der"))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  };
}
