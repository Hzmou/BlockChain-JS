class BlockchainService {
  constructor(blockchain) {
    if (!blockchain) {
      throw new Error("A blockchain instance is required.");
    }

    this.blockchain = blockchain;
  }

  submitTransaction(transaction) {
    this.blockchain.createTransaction(transaction);
    return transaction;
  }

  mineBlock(minerAddress) {
    this.blockchain.minePendingTransactions(minerAddress);
    return this.blockchain.getLatestBlock();
  }

  getBalance(address) {
    return this.blockchain.getBalanceOfAddress(address);
  }

  getChain() {
    return this.blockchain.chain.map((block) => ({
      ...block,
      transactions: block.transactions.map((transaction) => ({
        ...transaction,
      })),
    }));
  }

  getPendingTransactions() {
    return this.blockchain.pendingTransactions.map((transaction) => ({
      ...transaction,
    }));
  }

  isChainValid() {
    return this.blockchain.isChainValid();
  }
}

module.exports = BlockchainService;
