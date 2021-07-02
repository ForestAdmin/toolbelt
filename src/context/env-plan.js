const pkg = require('../../package.json');

const {
  DEFAULT_FOREST_URL,
  DEFAULT_TOKEN_PATH,
} = require('./constants');

module.exports = (plan) => plan
  .addStep('variables', (planVariables) => planVariables.addValue('env', {
    // ...process.env,
    DATABASE_SCHEMA: process.env.DATABASE_SCHEMA,
    DATABASE_URL: process.env.DATABASE_URL,
    FOREST_ENV_SECRET: process.env.FOREST_ENV_SECRET,
    FOREST_URL: process.env.FOREST_URL || DEFAULT_FOREST_URL,
    SILENT: process.env.SILENT,
    TOKEN_PATH: process.env.TOKEN_PATH || DEFAULT_TOKEN_PATH,
  }))
  .addStep('others', (planOthers) => planOthers
    .addModule('process', process)
    .addModule('pkg', pkg));
