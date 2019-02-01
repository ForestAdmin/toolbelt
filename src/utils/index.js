const bugsnag = require('@bugsnag/js');
const { BUGSNAG_API_KEY } = require('../../config/config');

const bugsnagClient = bugsnag(BUGSNAG_API_KEY);

function catchUnexpectedError(error) {
  if (error) {
    console.error(error);
    bugsnagClient.notify(error);
  }
}

exports.catchUnexpectedError = catchUnexpectedError;
