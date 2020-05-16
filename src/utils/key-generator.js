const P = require('bluebird');
const crypto = require('crypto');

const randomBytes = P.promisify(crypto.randomBytes);

async function generateKey() {
  return randomBytes(48).then((buffer) => buffer.toString('hex'));
}

module.exports = { generateKey };
