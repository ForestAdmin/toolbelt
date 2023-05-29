/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addModule('Sequelize', () => require('sequelize'))
    .addModule('mongodb', () => require('mongodb'))
    .addModule('Handlebars', () => require('handlebars'))
    .addUsingClass('database', () => require('../services/schema/update/database'))
    .addUsingClass('agentNodejsDumper', () => require('../services/dumpers/agent-nodejs').default)
    .addUsingClass('forestExpressDumper', () => require('../services/dumpers/forest-express'))
    .addModule('optionParser', () => require('../utils/option-parser'))
    .addUsingClass('projectCreator', () => require('../services/projects/create/project-creator'))
    .addUsingClass('spinner', () => require('../services/spinner'));
