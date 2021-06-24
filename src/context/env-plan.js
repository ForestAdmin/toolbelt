const pkg = require('../../package.json');

const { DEFAULT_FOREST_URL } = require('./constants');

module.exports = (plan) => plan
  .addStep('variables', (planVariables) => planVariables.addValue('env', {
    // ...process.env,
    FOREST_URL: process.env.FOREST_URL || DEFAULT_FOREST_URL,
  }))
  .addStep('others', (planOthers) => planOthers
    .addModule('process', process)
    .addModule('pkg', pkg));
