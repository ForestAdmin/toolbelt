const ApiErrorDeserializer = require('../deserializers/api-error');

const UNEXPECTED_ERROR_MESSAGE = 'Oops something went wrong.';
function handleError(rawError) {
  let error;
  // NOTICE: We check if the errors are from the API or if they've been thrown internally.
  if (!rawError.status) {
    error = rawError;
  } else {
    try {
      error = ApiErrorDeserializer.deserialize(rawError);
    } catch (e) {
      return UNEXPECTED_ERROR_MESSAGE;
    }
  }

  return error.message ? error.message : UNEXPECTED_ERROR_MESSAGE;
}

module.exports = { handleError };
