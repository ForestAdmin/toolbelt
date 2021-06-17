const Context = require('@forestadmin/context');

module.exports = {
  terminate(status, {
    logs,
  }) {
    const { exitProcess, logger } = Context.inject();

    if (logs.length) {
      logger.error(...logs);
    }

    exitProcess(status);
  },
};
