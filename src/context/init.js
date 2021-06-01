const { newPlan } = require('@forestadmin/context');
const chalk = require('chalk');
const os = require('os');
const superagent = require('superagent');
const inquirer = require('inquirer');
const openIdClient = require('openid-client');
const open = require('open');
const jwtDecode = require('jwt-decode');
const fs = require('fs');
const joi = require('joi');
const mkdirp = require('mkdirp');
const Handlebars = require('handlebars');
const path = require('path');

const Sequelize = require('sequelize');
const mongodb = require('mongodb');

require('../config');
const pkg = require('../../package.json');
const logger = require('../services/logger');
const Authenticator = require('../services/authenticator');
const messages = require('../utils/messages');
const terminator = require('../utils/terminator');
const OidcAuthenticator = require('../services/oidc/authenticator');
const ApplicationTokenService = require('../services/application-token');
const Api = require('../services/api');
const applicationTokenSerializer = require('../serializers/application-token');
const applicationTokenDeserializer = require('../deserializers/application-token');

const environmentDeserializer = require('../deserializers/environment');
const environmentSerializer = require('../serializers/environment');
const projectDeserializer = require('../deserializers/project');
const projectSerializer = require('../serializers/project');

const CommandGenerateConfigGetter = require('../../services/command-generate-config-getter');
const Database = require('../../services/database');
const DatabaseAnalyzer = require('../../services/analyzer/database-analyzer');
const Dumper = require('../../services/dumper');
const EventSender = require('../../services/event-sender');
const spinners = require('../../services/spinners');
const ProjectCreator = require('../../services/project-creator');
const ErrorHandler = require('../../services/error-handler');
const mongoAnalyzer = require('../../services/analyzer/mongo-collections-analyzer');
const sequelizeAnalyzer = require('../../services/analyzer/sequelize-tables-analyzer');
const SchemaService = require('../services/schema-service');

const DEFAULT_FOREST_URL = 'https://api.forestadmin.com';

/**
 * @typedef {{
 *   FOREST_URL: string;
 *   TOKEN_PATH: string;
 * }} Env
 *
 * @typedef {{
 *  env: Env
 *  process: NodeJS.Process,
 *  pkg: import('../../package.json'),
 *  config: import('../config'),
 * }} EnvPart
 *
 * @typedef {{
 *  chalk: import('chalk');
 *  os: import('os');
 *  fs: import('fs');
 *  superagent: import('superagent');
 *  inquirer: import('inquirer');
 *  openIdClient: import('openid-client');
 *  open: import('open');
 *  jwtDecode: import('jwt-decode');
 *  joi: import('joi');
 * }} Dependencies
 *
 * @typedef {{
 *  applicationTokenSerializer: import('../serializers/application-token');
 *  applicationTokenDeserializer: import('../deserializers/application-token');
 * }} Serializers
 *
 * @typedef {{
 *  terminator: import('../utils/terminator');
 *  messages: import('../utils/messages');
 * }} Utils
 *
 * @typedef {{
 *  logger: import('../services/logger');
 *  api: import('../services/api');
 *  oidcAuthenticator: import('../services/oidc/authenticator');
 *  authenticator: import('../services/authenticator');
 *  applicationTokenService: import('../services/application-token');
 * }} Services
 *
 * @typedef {EnvPart & Dependencies & Utils & Services & Serializers} Context
 */

const initConstants = (context) => context
  .addInstance('constants', {
    DEFAULT_FOREST_URL,
  });

const initEnv = newPlan()
  .addStep('variables', (context) => context.addValue('env', {
    // ...process.env,
    FOREST_URL: process.env.FOREST_URL || DEFAULT_FOREST_URL,
  }))
  .addStep('others', (context) => context
    .addInstance('process', process)
    .addInstance('pkg', pkg));

/**
 * @param {import('./application-context')} context
 */
const initDependencies = newPlan()
  .addStep('open', (context) => context
    .addFunction('open', open))
  .addStep('others', (context) => context
    .addInstance('chalk', chalk)
    .addInstance('os', os)
    .addInstance('fs', fs)
    .addInstance('superagent', superagent)
    .addInstance('inquirer', inquirer)
    .addInstance('openIdClient', openIdClient)
    .addInstance('jwtDecode', jwtDecode)
    .addInstance('joi', joi));

/**
 * @param {import('./application-context')} context
 */
const initUtils = (context) => context
  .addInstance('terminator', terminator)
  .addInstance('messages', messages);

/**
 * @param {import('./application-context')} context
 */
const initSerializers = (context) => context
  .addInstance('applicationTokenSerializer', applicationTokenSerializer)
  .addInstance('applicationTokenDeserializer', applicationTokenDeserializer)
  .addInstance('environmentDeserializer', environmentDeserializer)
  .addInstance('environmentSerializer', environmentSerializer)
  .addInstance('projectDeserializer', projectDeserializer)
  .addInstance('projectSerializer', projectSerializer);

/**
 * @param {import('./application-context')} context
 */
const initServices = newPlan()
  .addStep('dependencies', (context) => context
    .addInstance('logger', logger)
    .addClass(Api)
    .addClass(OidcAuthenticator)
    .addClass(ApplicationTokenService))
  .addStep('authenticator', (context) => context
    .addClass(Authenticator));

/**
 * @param {import('./application-context')} context
 */
const initCommandProjectsCreate = (context) => context
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
  .addInstance('spinners', spinners);

const initCommandSchemaUpdate = (context) => context
  .addInstance('path', path)
  .addClass(ErrorHandler)
  .addFunction('mongoAnalyzer', mongoAnalyzer)
  .addFunction('sequelizeAnalyzer', sequelizeAnalyzer)
  .addClass(DatabaseAnalyzer)
  .addClass(SchemaService);

module.exports = newPlan()
  .addStep('constants', initConstants)
  .addStep('env', initEnv)
  .addStep('dependencies', initDependencies)
  .addStep('utils', initUtils)
  .addStep('serializers', initSerializers)
  .addStep('services', initServices)
  .addStep('commandProjectCreate', initCommandProjectsCreate)
  .addStep('commandProjectUpdate', initCommandSchemaUpdate);
