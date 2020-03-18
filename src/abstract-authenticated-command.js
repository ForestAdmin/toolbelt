const { Command } = require('@oclif/command');
const chalk = require('chalk');
const authenticator = require('./services/authenticator');

class AbstractAuthenticatedCommand extends Command {
  async run() {
    if (!authenticator.getAuthToken()) {
      await authenticator.tryLogin({});
    }

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

  async runIfAuthenticated() {
    throw new Error(`'runIfAuthenticated' is not implemented on ${this.constructor.name}`);
  }

  displayLoginMessageAndQuit() {
    return this.error(`Please use ${chalk.bold('forest login')} to sign in to your Forest account.`, { exit: 10 });
  }
}

module.exports = AbstractAuthenticatedCommand;
