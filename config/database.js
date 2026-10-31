
const dentenv = require('dotenv');
const {pool} = require("pg");


/* 
  
   * Configuration code for the database connection using environment variables.
   * this file is used to set up the connection to the PostgreSQL database using the 'pg' library.
   * It reads and validate the postgres connection config,
   * creates a PostgreSQL connection pool, and exports a function to get the database connection, 
   * then closes the connection pool when the application is terminated.
   * @author Hamza Zm
   * @version 1.0.0
   * @since 2026-10-29
   *  

**/


dotenv.config();


function getDatabaseConnection() {


      // Read the database connection string from the environment variable.
    const connectionString = process.env.DATABASE_URL?.trim(); 



    if(!connectionString){
        throw new Error("DATABASE_URL environment variable is not set.");


    }


    let databaseUrl;

    try{

        
    }

}