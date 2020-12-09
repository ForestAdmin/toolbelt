const chalk = require('chalk');
const os = require('os');
const superagent = require('superagent');
const inquirer = require('inquirer');
const config = require('../config');
const pkg = require('../../package.json');
const logger = require('../services/logger');
const messages = require('../utils/messages');
const terminator = require('../utils/terminator');

/**
 * @typedef {{
 *   FOREST_URL: string;
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
 *  superagent: import('superagent');
 *  inquirer: import('inquirer');
 * }} Dependencies
 *
 * @typedef {{
 *  terminator: import('../utils/terminator');
 *  messages: import('../utils/messages');
 * }} Utils
 *
 * @typedef {{
 *  logger: import('../services/logger');
 *  api: import('../services/api');
 * }} Services
 *
 * @typedef {EnvPart & Dependencies & Utils & Services} Context
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
  context.addInstance('superagent', superagent);
  context.addInstance('inquirer', inquirer);
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
function initServices(context) {
  context.addInstance('logger', logger);
}

/**
 * @param {import('./application-context')<Context>} context
 * @returns {import('./application-context')<Context>}
 */
function initContext(context) {
  initEnv(context);
  initDependencies(context);
  initUtils(context);
  initServices(context);

  return context;
}

module.exports = initContext;
