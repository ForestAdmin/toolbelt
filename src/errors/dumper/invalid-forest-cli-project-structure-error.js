const ForestCLIError = require('../forest-cli-error');

class InvalidForestCLIProjectStructureError extends ForestCLIError {
  /**
   * @param {{
   *  reason?: string;
   *  possibleSolution?: string
   * }} [options]
   */
  constructor(path, reason) {
    super(`We are not able to detect a Forest CLI project file architecture at this path: ${path}.`, undefined, { reason });
    this.name = 'InvalidForestCLIProjectStructureError';
  }
}

module.exports = InvalidForestCLIProjectStructureError;
