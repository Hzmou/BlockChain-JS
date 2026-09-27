const SHA256 = require("crypto-js/sha256");

function hash(data) {
    return SHA256(data).toString();
}


// exports the hash function so that it can be used in other files.
module.exports = hash;