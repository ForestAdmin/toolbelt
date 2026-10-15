const { maskUrlCredentials } = require('./database-errors');
const ForestCLIError = require('../errors/forest-cli-error');

class ErrorHandler {
  /**
   * @param {import('../context/plan').Context} context
   */
  constructor({ assertPresent, chalk, messages, terminator }) {
    assertPresent({
      chalk,
      messages,
      terminator,
    });
    /** @private @readonly */
    this.terminator = terminator;
    /** @private @readonly */
    this.chalk = chalk;
    /** @private @readonly */
    this.messages = messages;
  }

  /**
   * @private
   * @param {ForestCLIError} error
   * @returns {string[]}
   */
  getMessages(error) {
    const messages = [];
    if (error.reason) {
      messages.push(`${this.chalk.red(error.message)}: ${error.reason}`);
    } else {
      messages.push(this.chalk.red(error.message));
    }

    if (error.possibleSolution) {
      messages.push(error.possibleSolution);
    }

    return messages;
  }

  /**
   * @param {Error} error
   */
  async handle(error) {
    if (error instanceof ForestCLIError) {
      await this.terminator.terminate(1, {
        logs: this.getMessages(error),
      });
    } else {
      // Masked: this message invites an issue, and a driver's error may quote a connection URL.
      const message = `${this.messages.ERROR_UNEXPECTED} ${this.chalk.red(
        maskUrlCredentials(error.message),
      )}`;
      await this.terminator.terminate(1, {
        logs: [message],
      });
    }
  }
}

module.exports = ErrorHandler;
