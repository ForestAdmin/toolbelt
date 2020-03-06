const logger = require('../services/logger');

module.exports = {
  terminate(status, {
    logs,
  }) {
    if (status !== 0 && logger.spinner) {
      logger.spinner.fail();
    }
    if (logs.length) {
      logger.error(...logs);
    }

    process.exit(status);
  },
};
