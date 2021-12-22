/* eslint-disable global-require */
module.exports = (plan) => plan
  .addUsingClass('keyGenerator', () => require('../utils/key-generator'))
  .addUsingFunction('terminator', require('../utils/terminator'))
  .addValue('messages', require('../utils/messages'));
