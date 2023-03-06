/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addUsingClass('keyGenerator', () => require('../utils/key-generator'))
    .addUsingClass('logger', () => require('../services/logger'))
    .addUsingClass('eventSender', () => require('../utils/event-sender'))
    .addUsingFunction('terminator', require('../utils/terminator'))
    .addValue('messages', require('../utils/messages'))
    .addFunction('buildDatabaseUrl', require('../utils/database-url').default)
    .addFunction('isDatabaseLocal', require('../utils/database-url').isDatabaseLocal)
    .addUsingClass('strings', () => require('../utils/strings').default);
