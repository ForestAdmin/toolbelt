import openIdClient from 'openid-client';

import ApplicationError from '../../errors/application-error';

export default class OidcError extends ApplicationError {
  constructor(message: string, origin?: Error, possibleSolution?: string) {
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
