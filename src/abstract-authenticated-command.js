const { Command } = require('@oclif/command');
const authenticator = require('./services/authenticator');
const chalk = require('chalk');
const { logError } = require('./utils');

class AbstractAuthenticatedCommand extends Command {
  async run() {
    if (!authenticator.getAuthToken()) {
      return this.displayLoginMessageAndQuit();
    }

    try {
      const result = await this.runIfAuthenticated();
      return result;
    } catch (error) {
      // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
      if (error.status === 403) {
        return this.error('💀  You do not have the right to execute this action on this project 💀');
      }

      if (error.status === 401) {
        await authenticator.logout();
        return this.displayLoginMessageAndQuit();
      }

      return logError(error, { exit: 1 });
    }
  }

  async runIfAuthenticated() {
    const error = new Error(`'runIfAuthenticated' is not implemented on ${this.constructor.name}`);
    logError(error, { exit: 1 });
  }

  displayLoginMessageAndQuit() {
    return this.error(`🔥  Please use ${chalk.bold('forest login')} to sign in to your Forest account. 🔥`, { exit: 10 });
  }
}

module.exports = AbstractAuthenticatedCommand;
