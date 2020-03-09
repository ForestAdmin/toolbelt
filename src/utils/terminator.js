const logger = require('../services/logger');

module.exports = {
  terminate(status, {
    logs,
  }) {
    if (logs.length) {
      logger.error(...logs);
    }
    process.exit(status);
  },
};
