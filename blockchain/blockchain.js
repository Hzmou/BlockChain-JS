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

  // create a tansaction and add it to the list of pending transactions.
  createTransaction(transaction) {
    // enhanicing this function to include a few more cases for security
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

  // function to check the validity of the blockchain.

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false; // The current block's hash is invalid
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false; // The previous block's hash does not match the current block's previousHash
      }

      // Additional checks can be added here if needed, such as verifying the integrity of transactions within the block.

      for (const trans of currentBlock.transactions) {
        const isReward = trans.fromAddress === null;

        if (
          (!isReward && !trans.fromAddress) ||
          !trans.toAddress ||
          !Number.isFinite(trans.amount) ||
          trans.amount <= 0
        ) {
          return false; // The transaction is invalid if it doesn't have a fromAddress, toAddress, or amount
        }
      }
    }

    return true;
  }
}

module.exports = Blockchain;
