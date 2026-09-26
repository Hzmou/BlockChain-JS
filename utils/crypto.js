const SHA256 = require("crypto-js/sha256");

function hash(data) {
    return SHA256(data).toString();
}

module.exports = hash;