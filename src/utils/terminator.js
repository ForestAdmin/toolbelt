const Context = require('@forestadmin/context');

module.exports = {
  terminate(status, {
    logs,
  }) {
    if (logs.length) {
      const { logger } = Context.inject();
      logger.error(...logs);
    }
    process.exit(status);
  },
};
