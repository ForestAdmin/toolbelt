const ApiErrorDeserializer = require('../deserializers/api-error');

const ERROR_MESSAGE_ENV_SECRET_ISSUE = '⚠️  Your development environment is not properly set up. Please run `forest init` first and retry.';

function apiErrorManager(error) {
  let apiError;
  try {
    apiError = ApiErrorDeserializer.deserialize(error);
  } catch (_) {
    // NOTICE: To deal with cases when an error couldn't be deserialized because thrown internally.
    apiError = error;
  }
  if (apiError.message) {
    // NOTICE: Here is the place to gather and interpret all the shared errors.
    if (apiError.message === 'Not development environment.') {
      return ERROR_MESSAGE_ENV_SECRET_ISSUE;
    }
    return apiError.message;
  }
  // NOTICE: Client issue or not well formatted server answer
  return 'Oops something went wrong';
}

module.exports = apiErrorManager;
