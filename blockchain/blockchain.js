/* Class representing a blockchain. */
/* This class is responsible for managing the chain of blocks, 
adding new blocks, and validating the integrity of the blockchain. */

const Block = require("./block");
const Transaction = require("./Transaction");

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()]; // Initialize the blockchain with the genesis block
    this.difficulty = 2; // Difficulty level for mining new blocks
    this.pendingTransactions = []; // Array to hold pending transactions
    this.miningReward = 100; // Reward for mining a new block
  }

  // function to create the first block in the blockchain,
  //  known as the genesis block

  createGenesisBlock() {
    return new Block(0, "01/01/2024", [], "0");
  }

  // get info about the latest block in the blockchain.
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // create a transaction and add it to the list of pending transactions.
  createTransaction(transaction) {
    // enhancing this function to include a few more cases for security
    //  and validity checks.

    //first we check if the transaction is valid.
    if (!transaction || typeof transaction !== "object") {
      throw new Error("A transaction is required.");
    }

    // destructure the transaction object to get fromAddress, toAddress, and amount.

    const { fromAddress, toAddress, amount } = transaction;

    // check if the fromAddress, toAddress, and amount are valid.

    if (typeof fromAddress !== "string" || !fromAddress.trim()) {
      throw new Error("A valid sender address is required.");
    }

    if (typeof toAddress !== "string" || !toAddress.trim()) {
      throw new Error("A valid recipient address is required.");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("A valid transaction amount is required.");
    }

    // calculate the pending outgoing transactions for the sender and check if the available balance is sufficient.
    const pendingOutgoing = this.pendingTransactions
      .filter((pending) => pending.fromAddress === fromAddress)
      .reduce((total, pending) => total + pending.amount, 0);

    // calculate the available balance for the sender by subtracting pending outgoing transactions from the current balance.
    const availableBalance =
      this.getBalanceOfAddress(fromAddress) - pendingOutgoing;

    // report an error if the transaction amount exceeds the available balance.
    if (amount > availableBalance) {
      throw new Error("Insufficient balance.");
    }

    // add the transaction to the list of pending transactions.
    this.pendingTransactions.push(transaction);
  }

  // function to mine a new block and add it to the blockchain.
  // create a new block in the block chain to add new pending block to it.

  minePendingTransactions(minerAddress) {
    const rewardTransaction = new Transaction(
      null,
      minerAddress,
      this.miningReward,
    );

    this.pendingTransactions.push(rewardTransaction);

    // create a new block with the pending transactions and add it to the blockchain.

    const block = new Block(
      this.chain.length,
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash,
    );

    block.mineBlock(this.difficulty);

    this.chain.push(block);

    // reset the list of pending transactions after mining a new block.
    this.pendingTransactions = [];
  }

  getBalanceOfAddress(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }

        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  /*
  function to check the validity of the blockchain.
  it checks the genesis block, block indexes and links, hashes, 
  proof-of-work, transaction structure, 
  and exactly one valid mining reward per mined block.
*/

  isChainValid() {
    // Reject a missing/empty chain or an invalid proof-of-work difficulty.
    if (
      !Array.isArray(this.chain) ||
      this.chain.length === 0 ||
      !Number.isInteger(this.difficulty) ||
      this.difficulty < 0
    ) {
      return false;
    }

    // Check the genesis block separately because it has no previous block
    // and should not contain transactions.
    const genesis = this.chain[0];

    if (
      !genesis ||
      typeof genesis.calculateHash !== "function" ||
      genesis.index !== 0 ||
      genesis.previousHash !== "0" ||
      !Array.isArray(genesis.transactions) ||
      genesis.transactions.length !== 0 ||
      !Number.isInteger(genesis.nonce) ||
      genesis.nonce < 0 ||
      typeof genesis.hash !== "string" ||
      genesis.hash !== genesis.calculateHash()
    ) {
      return false;
    }

    // Each mined block's hash must start with this many zeroes.
    const proofPrefix = "0".repeat(this.difficulty);

    // Check each block after the genesis block.
    for (let i = 1; i < this.chain.length; i++) {
      const block = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Check the block's structure, position, hash, link to the previous block,
      // and proof-of-work.
      if (
        !block ||
        typeof block.calculateHash !== "function" ||
        block.index !== i ||
        !Array.isArray(block.transactions) ||
        !Number.isInteger(block.nonce) ||
        block.nonce < 0 ||
        typeof block.hash !== "string" ||
        block.hash !== block.calculateHash() ||
        block.previousHash !== previousBlock.hash ||
        !block.hash.startsWith(proofPrefix)
      ) {
        return false;
      }

      let rewardCount = 0;

      // Check each transaction's basic fields and handle mining rewards separately.
      for (let j = 0; j < block.transactions.length; j++) {
        const transaction = block.transactions[j];

        if (
          !transaction ||
          typeof transaction !== "object" ||
          typeof transaction.toAddress !== "string" ||
          !transaction.toAddress.trim() ||
          !Number.isFinite(transaction.amount) ||
          transaction.amount <= 0
        ) {
          return false;
        }

        // A reward transaction has no sender. Require it to be the final
        // transaction and to have the configured reward amount.
        if (transaction.fromAddress === null) {
          rewardCount++;

          if (
            j !== block.transactions.length - 1 ||
            transaction.amount !== this.miningReward
          ) {
            return false;
          }
        } else if (
          // Normal transactions must have a non-empty sender address.
          typeof transaction.fromAddress !== "string" ||
          !transaction.fromAddress.trim()
        ) {
          return false;
        }
      }

      // Each mined block must contain exactly one reward transaction.
      if (rewardCount !== 1) {
        return false;
      }
    }

    // Every block passed the checks.
    return true;
  }
}

module.exports = Blockchain;
