// Import the readline module to handle user input from the command line.
const readLine = require("readline");

const Blockchain = require("./blockchain/blockchain");
const Transaction = require("./blockchain/Transaction");

// create an instance of the blockchain class, we'll call it myCoin.

const myCoin = new Blockchain();

// create an interface for reading input from the command line.

const r1 = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// function showMenu to dipslay the starting Menu of the application.

function showMenu() {
  console.log("\n==============================");
  console.log("      SIMPLE BLOCKCHAIN");
  console.log("==============================");
  console.log("1. Create Transaction");
  console.log("2. Mine Block");
  console.log("3. Check Balance");
  console.log("4. View Blockchain");
  console.log("5. Validate Blockchain");
  console.log("6. Tamper Blockchain");
  console.log("0. Exit");
  console.log("==============================");
  r1.question("Choose an option: ", handleChoice);
}

// function to handle the user's choice from the menu.
// and call functions based on the user's choice.

function handleChoice(choice) {
  switch (choice) {
    case "1":
      // Call the function to create a transaction
      createTransaction();
      break;
    case "2":
      // Call the function to mine a block
      mineBlock();
      break;
    case "3":
      // Call the function to check balance
      checkBalance();
      break;
    case "4":
      // Call the function to view the blockchain
      viewBlockchain();
      break;
    case "5":
      // Call the function to validate the blockchain
      validateBlockchain();
      break;
    case "6":
      // Call the function to tamper with the blockchain
      tamperBlockchain();
      break;
    case "0":
      // Exit the application
      r1.close();
      break;
    default:
      console.log("Invalid choice. Please try again.");
      showMenu();
      break;
  }
}

/* Function to create a new transaction */

function createTransaction() {
  r1.question("Enter the sender's address: ", (sender) => {
    r1.question("Enter the recipient address: ", (recipient) => {
      r1.question("Enter the desired amount: ", (amount) => {
        const transaction = new Transaction(sender, recipient, Number(amount));
        myCoin.createTransaction(transaction);
        console.log("Transaction created successfully.");
        showMenu();
      });
    });
  });
}

/* Function to mine a new block, this is just the main application function it calls 
   minePendingTransactions internally */

function mineBlock() {
  r1.question("Enter the miner's address: ", (minerAddress) => {
    console.log("\n⛏ Mining block...");

    myCoin.minePendingTransactions(minerAddress);
    console.log("Block mined successfully.");
    console.log(`Coins sent to the miner's address ${minerAddress}`);
    showMenu();
  });
}

/* Function to check the balance of a specific address 
   calls the getBalanceOfAddress method of the blockchain. */

function checkBalance() {
  r1.question("Enter your Address: ", (address) => {
    const balance = myCoin.getBalanceOfAddress(address);
    console.log(`Your balance is: ${balance}`);
    showMenu();
  });
}

// function to view the entire blockchain and all transactions within it.

function viewBlockchain() {
  console.log("\n=== Blockchain ===");

  for (const block of myCoin.chain) {
    const timestamp =
      typeof block.timestamp === "number"
        ? new Date(block.timestamp).toLocaleString()
        : block.timestamp;

    console.log(`\nBlock #${block.index}`);
    console.log(`Date: ${timestamp}`);

    if (Array.isArray(block.data)) {
      if (block.data.length === 0) {
        console.log("Transactions: none");
      } else {
        console.log("Transactions:");

        block.data.forEach((transaction, index) => {
          const sender = transaction.fromAddress ?? "Mining reward";
          console.log(
            `  ${index + 1}. ${sender} -> ${transaction.toAddress}: ${transaction.amount} coins`
          );
        });
      }
    } else {
      console.log(`Details: ${block.data}`);
    }

    console.log(`Hash: ${block.hash}`);
  }

  showMenu();
}

function validateBlockchain() {
  const isValid = myCoin.isChainValid();

  console.log(`Blockchain is ${isValid ? "valid" : "invalid"}`);

  showMenu();
}

/*
  Function to tamper with the blockchain.
  It modifies the first transaction of the second block if there are at least two blocks.
  If the blockchain has fewer than two blocks, it displays a message and returns to the menu.
  If the blockchain is empty, it displays a message and returns to the menu.
*/

function tamperBlockchain() {
  if (myCoin.chain.length < 2) {
    console.log("Not enough blocks to tamper with.");
    return showMenu();
  }

  if (myCoin.chain.length >= 2) {
    myCoin.chain[1].transactions[0].amount += 1; // Tamper with the first transaction of the second block
    console.log("Blockchain tampered with.");
  }
  showMenu();

  if (myCoin.chain.length == 0) {
    console.log("Blockchain is empty.");
    return showMenu();
  }
}

showMenu();



