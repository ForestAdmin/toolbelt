const { Command } = require('@oclif/command');
const chalk = require('chalk');
const logger = require('./services/logger');
const authenticator = require('./services/authenticator');

class AbstractAuthenticatedCommand extends Command {
  async run() {
    if (!authenticator.getAuthToken()) {
      logger.info('Login required.');
      await authenticator.tryLogin({});
    }

    // NOTICE: Check if really authenticated before executing runIfAuthenticated() function.
    if (authenticator.getAuthToken()) {
      try {
        return await this.runIfAuthenticated();
      } catch (error) {
        // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
        if (error.status === 403) {
          return this.error('You do not have the right to execute this action on this project');
        }

        if (error.status === 401) {
          await authenticator.logout();
          return this.displayLoginMessageAndQuit();
        }

        throw error;
      }
    }
    return process.exit();
  }

  async runIfAuthenticated() {
    throw new Error(`'runIfAuthenticated' is not implemented on ${this.constructor.name}`);
  }

  displayLoginMessageAndQuit() {
    return this.error(`Please use ${chalk.bold('forest login')} to sign in to your Forest account.`, { exit: 10 });
  }
}

module.exports = AbstractAuthenticatedCommand;
