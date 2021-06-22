const { newPlan } = require('@forestadmin/context');

const chalk = require('chalk');
const crypto = require('crypto');
const fs = require('fs');
const Handlebars = require('handlebars');
const inquirer = require('inquirer');
const joi = require('joi');
const jwtDecode = require('jwt-decode');
const mkdirp = require('mkdirp');
const open = require('open');
const openIdClient = require('openid-client');
const os = require('os');
const path = require('path');
const superagent = require('superagent');

const mongodb = require('mongodb');
const Sequelize = require('sequelize');

require('../config');

const pkg = require('../../package.json');
const Logger = require('../services/logger');
const Authenticator = require('../services/authenticator');
const KeyGenerator = require('../utils/key-generator');
const messages = require('../utils/messages');
const terminator = require('../utils/terminator');
const terminatorSender = require('../utils/terminator-sender');
const OidcAuthenticator = require('../services/oidc/authenticator');
const ApplicationTokenService = require('../services/application-token');
const Api = require('../services/api');
const applicationTokenSerializer = require('../serializers/application-token');
const applicationTokenDeserializer = require('../deserializers/application-token');

const environmentDeserializer = require('../deserializers/environment');
const environmentSerializer = require('../serializers/environment');
const projectDeserializer = require('../deserializers/project');
const projectSerializer = require('../serializers/project');

const GeneralPrompter = require('../services/prompter/general-prompter');
const CommandGenerateConfigGetter = require('../services/projects/create/command-generate-config-getter');
const Database = require('../services/schema/update/database');
const DatabaseAnalyzer = require('../services/schema/update/analyzer/database-analyzer');
const Dumper = require('../services/dumper/dumper');
const EventSender = require('../utils/event-sender');
const Spinner = require('../services/spinner');
const ProjectCreator = require('../services/projects/create/project-creator');
const ErrorHandler = require('../utils/error-handler');
const mongoAnalyzer = require('../services/schema/update/analyzer/mongo-collections-analyzer');
const sequelizeAnalyzer = require('../services/schema/update/analyzer/sequelize-tables-analyzer');
const SchemaService = require('../services/schema/schema-service');

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

const initProcess = newPlan()
  .addStep('exit', (context) => context
    .addFunction('exitProcess', (exitCode) => process.exit(exitCode)));

const initConstants = (context) => context
  .addValue('constants', {
    DEFAULT_FOREST_URL,
  });

const initEnv = newPlan()
  .addStep('variables', (context) => context.addValue('env', {
    // ...process.env,
    FOREST_URL: process.env.FOREST_URL || DEFAULT_FOREST_URL,
  }))
  .addStep('others', (context) => context
    .addModule('process', process)
    .addModule('pkg', pkg));

/**
 * @param {import('./application-context')} context
 */
const initDependencies = newPlan()
  .addStep('open', (context) => context
    .addFunction('open', open))
  .addStep('std', (context) => context
    .addFunction('stdout', process.stdout)
    .addFunction('stderr', process.stderr))
  .addStep('inquirer', (context) => context
    .addInstance('inquirer', inquirer))
  .addStep('others', (context) => context
    .addModule('chalk', chalk)
    .addModule('crypto', crypto)
    .addModule('os', os)
    .addModule('fs', fs)
    .addModule('superagent', superagent)
    .addModule('openIdClient', openIdClient)
    .addModule('jwtDecode', jwtDecode)
    .addModule('joi', joi));

/**
 * @param {import('./application-context')} context
 */
const initUtils = (context) => context
  .addClass(KeyGenerator)
  .addInstance('terminator', terminator)
  .addInstance('terminatorSender', terminatorSender)
  .addValue('messages', messages);

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
    .addClass(Logger)
    .addClass(Api)
    .addClass(OidcAuthenticator)
    .addClass(ApplicationTokenService))
  .addStep('authenticator', (context) => context
    .addClass(Authenticator));

const initCommandProjectsCommon = (context) => context
  .addFunction('mongoAnalyzer', mongoAnalyzer)
  .addFunction('sequelizeAnalyzer', sequelizeAnalyzer)
  .addClass(DatabaseAnalyzer);

const initCommandProjectsCreate = (context) => context
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

const initCommandSchemaUpdate = (context) => context
  .addModule('path', path)
  .addClass(ErrorHandler)
  .addClass(SchemaService);

module.exports = () => newPlan()
  .addStep('process', initProcess)
  .addStep('constants', initConstants)
  .addStep('env', initEnv)
  .addStep('dependencies', initDependencies)
  .addStep('utils', initUtils)
  .addStep('serializers', initSerializers)
  .addStep('services', initServices)
  .addStep('commandProjectCommon', initCommandProjectsCommon)
  .addStep('commandProjectCreate', initCommandProjectsCreate)
  .addStep('commandProjectUpdate', initCommandSchemaUpdate);
