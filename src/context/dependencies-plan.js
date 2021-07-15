/* eslint-disable global-require */
module.exports = (plan) => plan
  .addStep('open', (planOpen) => planOpen
    .addFunction('open', require('open')))
  .addStep('std', (planStd) => planStd
    .addFunction('stdout', process.stdout)
    .addFunction('stderr', process.stderr))
  .addStep('inquirer', (planInquirer) => planInquirer
    .addInstance('inquirer', require('inquirer')))
  .addStep('jwtDecode', (planJWTDecode) => planJWTDecode
    .addInstance('jwtDecode', require('jwt-decode')))
  .addStep('others', (planOthers) => planOthers
    .addModule('mkdirp', () => require('mkdirp'))
    .addInstance('Table', require('cli-table'))
    .addModule('chalk', () => require('chalk'))
    .addModule('crypto', () => require('crypto'))
    .addModule('fs', () => require('fs'))
    .addModule('joi', () => require('joi'))
    .addModule('openIdClient', () => require('openid-client'))
    .addModule('os', () => require('os'))
    .addModule('superagent', () => require('superagent')));
