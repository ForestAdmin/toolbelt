const crypto = require('crypto');

function generateKey() {
  return crypto.randomBytes(48).toString('hex');
}

module.exports = { generateKey };
