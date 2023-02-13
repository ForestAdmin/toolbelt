/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addUsingClass('keyGenerator', () => require('../utils/key-generator'))
    .addUsingClass('logger', () => require('../services/logger'))
    .addUsingClass('eventSender', () => require('../utils/event-sender'))
    .addUsingFunction('terminator', require('../utils/terminator'))
    .addValue('messages', require('../utils/messages'));
