/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addPackage('dependencies', require('./dependencies-plan'))
    .addPackage('env', require('./env-plan'))
    .addUsingClass('logger', () => require('../services/logger'));
