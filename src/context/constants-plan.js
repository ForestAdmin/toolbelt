const constants = require('./constants');

module.exports = (plan) => plan
  .addValue('constants', constants);
