const chalk = require('chalk');
const os = require('os');
const superagent = require('superagent');
const inquirer = require('inquirer');
const openIdClient = require('openid-client');
const open = require('open');
const jwtDecode = require('jwt-decode');
const fs = require('fs');
const joi = require('joi');

const Sequelize = require('sequelize');
const mongodb = require('mongodb');

const config = require('../config');
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

const CommandGenerateConfigGetter = require('../../services/command-generate-config-getter');
const Database = require('../../services/database');
const DatabaseAnalyzer = require('../../services/analyzer/database-analyzer');
const Dumper = require('../../services/dumper');
const EventSender = require('../../services/event-sender');
const spinners = require('../../services/spinners');
const ProjectCreator = require('../../services/project-creator');

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

/**
 * @param {import('./application-context')} context
 */
function initEnv(context) {
  context.addInstance('env', {
    ...process.env,
    FOREST_URL: process.env.FOREST_URL || 'https://api.forestadmin.com',
  });
  context.addInstance('process', process);
  context.addInstance('pkg', pkg);
  context.addInstance('config', config);
}

/**
 * @param {import('./application-context')} context
 */
function initDependencies(context) {
  context.addInstance('chalk', chalk);
  context.addInstance('os', os);
  context.addInstance('fs', fs);
  context.addInstance('superagent', superagent);
  context.addInstance('inquirer', inquirer);
  context.addInstance('openIdClient', openIdClient);
  context.addInstance('jwtDecode', jwtDecode);
  context.addInstance('joi', joi);

  // We need to change the behavior of the open function for tests
  // because we don't want the tests to open a browser for real at each run
  // as the dependencies are injected once in the constructor, we cannot just
  // replace the reference of `open` by a mock (the service will still have
  // the real open function in its properties).
  // Instead, we change the value of `realOpen`, which will be accessed by
  // the function open which is just here to keep a reference to the context.
  context.addInstance('realOpen', open);
  context.addFunction('open', (...args) => context.get().realOpen(...args));
}

/**
 * @param {import('./application-context')} context
 */
function initUtils(context) {
  context.addInstance('terminator', terminator);
  context.addInstance('messages', messages);
}

/**
 * @param {import('./application-context')} context
 */
function initSerializers(context) {
  context.addInstance('applicationTokenSerializer', applicationTokenSerializer);
  context.addInstance('applicationTokenDeserializer', applicationTokenDeserializer);
}

/**
 * @param {import('./application-context')} context
 */
function initServices(context) {
  context.addInstance('logger', logger);
  context.addClass(Api);
  context.addClass(OidcAuthenticator);
  context.addClass(ApplicationTokenService);
  context.addClass(Authenticator);
}

/**
 * @param {import('./application-context')} context
 */
function initCommandProjectsCreate(context) {
  context.addInstance('Sequelize', Sequelize);
  context.addInstance('mongodb', mongodb);

  context.addClass(CommandGenerateConfigGetter);
  context.addClass(DatabaseAnalyzer);
  context.addClass(Database);
  context.addClass(Dumper);
  context.addClass(EventSender);
  context.addClass(ProjectCreator);
  context.addInstance('spinners', spinners);
}

/**
 * @param {import('./application-context')<Context>} context
 * @returns {import('./application-context')<Context>}
 */
function initContext(context) {
  initEnv(context);
  initDependencies(context);
  initUtils(context);
  initSerializers(context);
  initServices(context);

  initCommandProjectsCreate(context);

  return context;
}

module.exports = initContext;
