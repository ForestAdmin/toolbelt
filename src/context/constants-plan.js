const constants = require('./constants');

module.exports = (plan) => plan
  .addValue('constants', {
    ...constants,
    CURRENT_WORKING_DIRECTORY: process.cwd(),
  });
