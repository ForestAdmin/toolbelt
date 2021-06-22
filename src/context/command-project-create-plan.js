const mkdirp = require('mkdirp');
const Handlebars = require('handlebars');
const Sequelize = require('sequelize');
const mongodb = require('mongodb');
const GeneralPrompter = require('../services/prompter/general-prompter');
const CommandGenerateConfigGetter = require('../services/projects/create/command-generate-config-getter');
const Database = require('../services/schema/update/database');
const Dumper = require('../services/dumper/dumper');
const EventSender = require('../utils/event-sender');
const Spinner = require('../services/spinner');
const ProjectCreator = require('../services/projects/create/project-creator');

module.exports = (plan) => plan
  .addModule('Sequelize', Sequelize)
  .addModule('mongodb', mongodb)
  .addModule('mkdirp', mkdirp)
  .addModule('Handlebars', Handlebars)
  .addClass(Database)
  .addClass(Dumper)
  .addClass(EventSender)
  .addValue('GeneralPrompter', GeneralPrompter)
  .addClass(CommandGenerateConfigGetter)
  .addClass(ProjectCreator)
  .addClass(Spinner);
