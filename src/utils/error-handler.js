const LumberError = require('../errors/lumber-error');

class ErrorHandler {
  /**
   * @param {import('../context/plan').Context} context
   */
  constructor({
    assertPresent,
    chalk,
    messages,
    terminator,
  }) {
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
   * @param {LumberError} error
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
    if (error instanceof LumberError) {
      await this.terminator.terminate(1, {
        logs: this.getMessages(error),
      });
    } else {
      const message = `${this.messages.ERROR_UNEXPECTED} ${this.chalk.red(error.message)}`;
      await this.terminator.terminate(1, {
        logs: [message],
      });
    }
  }
}

module.exports = ErrorHandler;
