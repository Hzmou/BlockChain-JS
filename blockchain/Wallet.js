

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


class Wallet{


// generate a unique key pair for the wallet and assign an address.

constructor() {


      const { publicKey, privateKey } = generateKeyPairSync("ec", {
      namedCurve: "secp256k1",
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.address =  Wallet.addressFromPublicKey(publicKey);


}


//function to derive the wallet address from a given public key.
static addressFromPublicKey(publicKey) {
    return createHash("sha256").update(publicKey).digest("hex");
  }






}