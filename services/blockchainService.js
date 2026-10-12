const Blockchain = require("../blockchain/blockchain");


class BlockchainService {


    constructor(){

        if(!Blockchain){
            throw new Error("Blockchain module not found.");



        }

        this.Blockchain = Blockchain;
    }


    submitTransaction(transaction){
      this.Blockchain.createTransaction(transaction);
      return transaction;


    }

}



module.exports = BlockchainService;