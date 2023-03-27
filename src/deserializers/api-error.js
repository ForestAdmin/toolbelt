function deserialize(error) {
  if (!error || !error.status) {
    throw new Error('Wrong API Error format');
  }

  const deserializedError = {
    status: error.status,
    message: null,
    meta: null,
  };

  if (error.response && error.response.text) {
    const errorDetails = JSON.parse(error.response.text);
    if (errorDetails.errors && errorDetails.errors[0]) {
      if (errorDetails.errors[0].detail) {
        deserializedError.message = errorDetails.errors[0].detail;
      }
      if (errorDetails.errors[0].meta) {
        deserializedError.meta = errorDetails.errors[0].meta;
      }
    }
  }

  return deserializedError;
}

module.exports = { deserialize };
