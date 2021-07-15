const ForestCLIError = require('../forest-cli-error');

class IncompatibleLianaForUpdateError extends ForestCLIError {
  /**
   * @param {{
   *  reason?: string;
   *  possibleSolution?: string
   * }} [options]
   */
  constructor(reason) {
    super('The liana is incompatible for update', undefined, { reason });
    this.name = 'IncompatibleLianaForUpdateError';
  }
}

module.exports = IncompatibleLianaForUpdateError;
