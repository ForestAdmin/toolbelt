const KeyGenerator = require('../utils/key-generator');
const messages = require('../utils/messages');
const terminator = require('../utils/terminator');
const terminatorSender = require('../utils/terminator-sender');

module.exports = (plan) => plan
  .addClass(KeyGenerator)
  .addInstance('terminator', terminator)
  .addInstance('terminatorSender', terminatorSender)
  .addValue('messages', messages);
