function deserialize(error) {
  if (!error || !error.status) {
    throw new Error('Wrong API Error format');
  }

  const deserializedError = {
    status: error.status,
    message: null,
  };

  if (error.response && error.response.text) {
    try {
      const errorDetails = JSON.parse(error.response.text);
      if (errorDetails.errors && errorDetails.errors[0] && errorDetails.errors[0].detail) {
        deserializedError.message = errorDetails.errors[0].detail;
      }
    } catch (e) {
      // In case the error.response.text is not parsable, return it as-is.
      deserializedError.message = error.response.text;
    }
  }

  return deserializedError;
}

module.exports = { deserialize };
