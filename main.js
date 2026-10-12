// Import the readline module to handle user input from the command line.
const readLine = require("readline");
const Blockchain = require("./blockchain/blockchain");
const Wallet = require("./blockchain/wallet");

// create an instance of the blockchain class, we'll call it myCoin.

const myCoin = new Blockchain();
// wallet registry where all created wallets will be stored.
const wallets = new Map();

// create an interface for reading input from the command line.

const r1 = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// function showMenu to display the starting Menu of the application.

function showMenu() {
  const colors = process.stdout.isTTY
    ? {
        reset: "\x1b[0m",
        cyan: "\x1b[36m",
        blue: "\x1b[34m",
        dim: "\x1b[2m",
        bold: "\x1b[1m",
      }
    : { reset: "", cyan: "", blue: "", dim: "", bold: "" };
  const contentWidth = 44;
  const border = `+${"-".repeat(contentWidth + 2)}+`;
  const line = (text = "") => `| ${text.padEnd(contentWidth)} |`;
  const center = (text) =>
    text
      .padStart(Math.floor((contentWidth + text.length) / 2))
      .padEnd(contentWidth);

  console.log(`\n${colors.cyan}${border}`);
  console.log(line(center("SIMPLE BLOCKCHAIN")));
  console.log(line(center("WALLET & LEDGER")));
  console.log(`${border}${colors.reset}`);
  console.log(`${colors.dim}${line("LEDGER")}${colors.reset}`);
  console.log(`${colors.blue}${line("1  Create transaction")}${colors.reset}`);
  console.log(`${colors.blue}${line("2  Mine block")}${colors.reset}`);
  console.log(`${colors.blue}${line("3  Check balance")}${colors.reset}`);
  console.log(`${colors.blue}${line("4  View blockchain")}${colors.reset}`);
  console.log(`${colors.blue}${line("5  Validate blockchain")}${colors.reset}`);
  console.log(`${colors.blue}${line("6  Tamper blockchain")}${colors.reset}`);
  console.log(`${colors.dim}${line("WALLET")}${colors.reset}`);
  console.log(`${colors.blue}${line("7  Create wallet")}${colors.reset}`);
  console.log(`${border}`);
  console.log(`${colors.dim}${line("0  Exit")}${colors.reset}`);
  console.log(`${colors.cyan}${border}${colors.reset}`);
  r1.question(
    `${colors.bold}Choose an option${colors.reset} ${colors.cyan}>${colors.reset} `,
    handleChoice,
  );
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
    case "7":
      // Call the function to create a wallet
      createWallet();
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

/* Function to create a new transaction, 
this implementation includes wallet integration.  */

function createTransaction() {
  if (wallets.size === 0) {
    console.log("Create a wallet before sending a transaction.");
    return showMenu();
  }

  r1.question("Enter your wallet address: ", (senderAddress) => {
    const wallet = wallets.get(senderAddress.trim());

    if (!wallet) {
      console.log("No wallet found in this address. ");
      return showMenu();
    }

    r1.question("Enter the recipient's address: ", (recipientAddress) => {
      r1.question("Enter the amount to send: ", (amount) => {
        try {
          const transaction = wallet.createTransaction(
            recipientAddress.trim(),
            Number(amount),
          );
          myCoin.createTransaction(transaction);
          console.log("Signed transaction added successfully.");
        } catch (error) {
          console.log(`Transaction failed: ${error.message}`);
        }

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

    if (Array.isArray(block.transactions)) {
      if (block.transactions.length === 0) {
        console.log("Transactions: none");
      } else {
        console.log("Transactions:");

        block.transactions.forEach((transaction, index) => {
          const sender = transaction.fromAddress ?? "Mining reward";
          console.log(
            `  ${index + 1}. ${sender} -> ${transaction.toAddress}: ${transaction.amount} coins`,
          );
        });
      }
    } else {
      console.log(`Details: ${block.transactions}`);
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

function createWallet() {
  const wallet = new Wallet();

  wallets.set(wallet.address, wallet);
  console.log("New wallet created:");
  console.log(`Address: ${wallet.address}`);
  console.log(`Public Key: ${wallet.publicKey}`);
  showMenu();
}

showMenu();
