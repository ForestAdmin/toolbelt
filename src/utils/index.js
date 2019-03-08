const Errors = require('@oclif/errors');
const bugsnag = require('@bugsnag/js');
const { BUGSNAG_API_KEY } = require('../../config/config');

const bugsnagClient = bugsnag(BUGSNAG_API_KEY);

function logError(error, options) {
  bugsnagClient.notify(error);
  Errors.error(error, options);
}

exports.logError = logError;
