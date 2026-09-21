const ForestCLIError = require('../forest-cli-error');

/**
 * A value the user typed, refused by an option's `validate` or emptied by its `filter`.
 * It is a user-facing error, not an internal failure: callers print it as it stands.
 */
class InvalidOptionError extends ForestCLIError {}

module.exports = InvalidOptionError;
