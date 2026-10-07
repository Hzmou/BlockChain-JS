

// Import the readline module to handle user input from the command line.
const readLine = require('readline'); 


const Blockchain = require('./blockchain/blockchain');
const Transaction = require('./blockchain/Transaction');


// create an instance of the blockchain class, we'll call it myCoin. 

const myCoin = new Blockchain();


// create an interface for reading input from the command line.

const r1 = readLine.createInterface({
    input: process.stdin,
    output: process.stdout
});

// function showMenu to dipslay the starting Menu of the application. 


function showMenu(){

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

function handleChoice(choice){



    switch(choice){


        case '1':
            // Call the function to create a transaction
            createTransaction();
            break;
        case '2':
            // Call the function to mine a block
            mineBlock();
            break;
        case '3':
            // Call the function to check balance
            checkBalance();
            break;
        case '4':
            // Call the function to view the blockchain
            viewBlockchain();
            break;
        case '5':
            // Call the function to validate the blockchain
            validateBlockchain();
            break;
        case '6':
            // Call the function to tamper with the blockchain
            tamperBlockchain();
            break;
        case '0':
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

   function createTransaction(){
     
       r1.question("Enter the sender's address: " , (sender) => {
           r1.question("Enter the recipient address: " , (recipient) => {
               r1.question("Enter the desired amount: " , (amount) => {


                  const transaction =  new Transaction(sender, recipient, Number(amount));
                   myCoin.createTransaction(transaction);
                   console.log("Transaction created successfully.");
                   showMenu();

               });
           });
       });
   }

