/**
 * @typedef {{
 *  errorCode: string;
 *  errorMessage: string;
 *  context: any;
 * }} DetailedLog
 *
 * @typedef {{
 *  logs: string[]
 * }} MultipleMessages
 */

module.exports = ({ assertPresent, eventSender, exitProcess, logger }) => {
  assertPresent({ eventSender, exitProcess, logger });

  return {
    /**
     * @param {number} status
     * @param {DetailedLog | MultipleMessages | DetailedLog & MultipleMessages} log
     */
    async terminate(status, { errorCode, errorMessage, logs, context }) {
      if (logs.length) {
        logger.error(...logs);
      }

      if (errorCode) {
        await eventSender.notifyError(errorCode, errorMessage, context);
      } else {
        await eventSender.notifyError();
      }

      return exitProcess(status);
    },
  };
};
