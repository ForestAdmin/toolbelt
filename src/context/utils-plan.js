const KeyGenerator = require('../utils/key-generator');
const messages = require('../utils/messages');
const terminator = require('../utils/terminator');

module.exports = (plan) => plan
  .addClass(KeyGenerator)
  .addInstance('terminator', terminator)
  .addValue('messages', messages);
