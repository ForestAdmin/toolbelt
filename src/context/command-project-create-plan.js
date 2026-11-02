/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addModule('Sequelize', () => require('sequelize'))
    // Every command builds this plan, so the driver is only loaded once a NoSQL path connects:
    // its URL parser pulls in Node's deprecated `punycode`, whose warning breaks into prompts.
    .addModule('mongodb', () => ({
      get MongoClient() {
        return require('mongodb').MongoClient;
      },
    }))
    .addModule('Handlebars', () => require('handlebars'))
    .addUsingClass('database', () => require('../services/schema/update/database'))
    .addUsingClass('agentNodejsDumper', () => require('../services/dumpers/agent-nodejs').default)
    .addUsingClass('forestExpressDumper', () => require('../services/dumpers/forest-express'))
    .addModule('optionParser', () => require('../utils/option-parser'))
    .addUsingClass('projectCreator', () => require('../services/projects/create/project-creator'))
    .addUsingClass('spinner', () => require('../services/spinner'));
