/*
    Browser side wallet module that imports Noble and exposes and safe signing methods for 
    the browser to use. This is a wrapper around the noble library that provides a 
    simple interface for signing messages and transactions in the browser.
**/

import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";

const spkiPrefix = new Uint8Array([
  0x30, 0x56, 0x30, 0x10, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x05, 0x2b, 0x81, 0x04, 0x00, 0x0a, 0x03, 0x42, 0x00,
]);

/**
 * convert bytes to a base 64 in the browser.
 * @param {Uint8Array} bytes - The bytes to convert.
 * @returns {string} - The base 64 encoded string.
 *
 */

function toBase64(bytes) {
  let binary = "";
  for (const i of bytes) {
    binary += String.fromCharCode(i);
  }

  return btoa(binary);
}
