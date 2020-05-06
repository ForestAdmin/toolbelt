const ApiErrorDeserializer = require('../deserializers/api-error');

function handleError(rawError) {
  let error;
  // NOTICE: We check if the errors are from the API or if they've been thrown internally.
  if (!rawError.status) {
    error = rawError;
  } else {
    error = ApiErrorDeserializer.deserialize(rawError);
  }

  return error.message ? error.message : 'Oops something went wrong';
}

module.exports = handleError;
