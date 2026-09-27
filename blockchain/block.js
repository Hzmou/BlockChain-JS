

/* Main class that defines a block in the blockchain. */


const hash = require("../utils/crypto");

class Block {


constructor(index, timestamp, data,previousHash = ""){

    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
    this.nonce = 0;
}
  

calculateHash() {
     return hash(this.index+
    this.previousHash+this.timestamp+
    JSON.stringify(this.data)+ 
    this.nonce
     );


}


/*

   * proof of work algorith to mine a block by finding a hash
   * in the blockchain that starts with a certain number of 
   * leading zeros. 
*/ 

mineBlock(difficulty) {

const target = "0".repeat(difficulty);


while(this.hash.substring(0,difficulty) !== target){


     // check if the hash of the block starts with a 
     // certain number of leading zeros. 
    
        this.nonce++;
        this.hash = this.calculateHash();
    



}


console.log(`Block mined: ${this.hash}`);
console.log(`Nonce: ${this.nonce}`);
console.log('Hash: ', this.hash);

}



}


// export the block class to be used in other files. 

module.exports = Block;


