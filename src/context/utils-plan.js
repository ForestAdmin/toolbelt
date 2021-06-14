const messages = require('../utils/messages');
const terminator = require('../utils/terminator');

module.exports = (plan) => plan
  .addInstance('terminator', terminator)
  .addInstance('messages', messages);
