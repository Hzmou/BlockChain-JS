

/* Class representing a blockchain. */
/* This class is responsible for managing the chain of blocks, 
adding new blocks, and validating the integrity of the blockchain. */



class Blockchain {

constructor() {
    

   this.chain = [this.createGenesisBlock()];    
   this.difficulty = 2; // Difficulty level for mining new blocks
   this.pendingTransactions = []; // Array to hold pending transactions
   this.miningReward=100; // Reward for mining a new block

}

// function to create the first block in the blockchain,
//  known as the genesis block

createGenesisBlock() {
   
   return new Block(
    0, "01/01/2024", "Genesis Block", "0"
   );

}


// get info about the latest block in the blockchain. 
getLatestBlock(){

   return this.chain[this.chain.length - 1];

}


// create a tansaction and add it to the list of pending transactions.
createTransaction(Transaction){

    this.pendingTransactions.push(Transaction);


}

// function to mine a new block and add it to the blockchain.

minePendingTransactions(minerAddress){
    

    const rewardTransaction = new Transaction(null, minerAddress, this.miningReward);




}






}