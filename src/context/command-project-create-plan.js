/* eslint-disable global-require */
module.exports = (plan) => plan
  .addModule('Sequelize', () => require('sequelize'))
  .addModule('mongodb', () => require('mongodb'))
  .addModule('Handlebars', () => require('handlebars'))
  .addUsingClass('database', () => require('../services/schema/update/database'))
  .addUsingClass('dumper', () => require('../services/dumper/dumper'))
  .addValue('GeneralPrompter', () => require('../services/prompter/general-prompter'))
  .addUsingClass('commandGenerateConfigGetter', () => require('../services/projects/create/command-generate-config-getter'))
  .addUsingClass('projectCreator', () => require('../services/projects/create/project-creator'))
  .addUsingClass('spinner', () => require('../services/spinner'));
