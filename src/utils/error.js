const ApiErrorDeserializer = require('../deserializers/api-error');

const UNEXPECTED_ERROR_MESSAGE = 'Oops something went wrong.';

function getError(rawError) {
  let error;
  // NOTICE: We check if the errors are from the API (have a status) or if thrown internally.
  if (rawError.status) {
    try {
      error = ApiErrorDeserializer.deserialize(rawError);
    } catch (e) {
      return UNEXPECTED_ERROR_MESSAGE;
    }
  } else {
    error = rawError;
  }

  return error;
}

function handleError(rawError) {
  const error = getError(rawError);
  return error.message ? error.message : UNEXPECTED_ERROR_MESSAGE;
}

function handleErrorWithMeta(rawError) {
  const error = getError(rawError);
  return {
    message: error.message,
    meta: error.meta,
  };
}

module.exports = { handleError, handleErrorWithMeta };
