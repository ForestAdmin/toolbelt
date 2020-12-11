const openIdClient = require('openid-client');
const ApplicationError = require('../../utils/application-error');

class OidcError extends ApplicationError {
  /**
   * @param {string} message
   * @param {Error|undefined} origin
   * @param {string} [possibleSolution]
   */
  constructor(message, origin, possibleSolution) {
    let reason;

    if (origin instanceof openIdClient.errors.OPError) {
      /** @public @readonly @type {string} */
      reason = origin.error || origin.message;
    } else if (origin) {
      reason = origin.message;
    }

    const parts = [
      reason ? `${message}: ${reason}.` : `${message}.`,
      possibleSolution ? `${possibleSolution}.` : '',
    ].filter(Boolean);

    super(parts.join(' '));

    this.name = 'OidcError';
    Error.captureStackTrace(this, OidcError);
  }
}

module.exports = OidcError;
