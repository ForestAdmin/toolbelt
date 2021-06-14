const mkdirp = require('mkdirp');
const Handlebars = require('handlebars');
const Sequelize = require('sequelize');
const mongodb = require('mongodb');
const CommandGenerateConfigGetter = require('../services/projects/create/command-generate-config-getter');
const Database = require('../services/schema/update/database');
const Dumper = require('../services/dumper/dumper');
const EventSender = require('../utils/event-sender');
const spinners = require('../utils/spinners');
const Spinner = require('../services/spinner');
const ProjectCreator = require('../services/projects/create/project-creator');
const DatabaseAnalyzer = require('../services/schema/update/analyzer/database-analyzer');

module.exports = (plan) => plan
  .addInstance('Sequelize', Sequelize)
  .addInstance('mongodb', mongodb)
  .addInstance('mkdirp', mkdirp)
  .addInstance('Handlebars', Handlebars)
  .addClass(Database)
  .addClass(Dumper)
  .addClass(EventSender)
  .addInstance('CommandGenerateConfigGetter', CommandGenerateConfigGetter)
  .addInstance('DatabaseAnalyzer', DatabaseAnalyzer)
  .addInstance('ProjectCreator', ProjectCreator)
  .addInstance('spinners', spinners)
  .addClass(Spinner);
