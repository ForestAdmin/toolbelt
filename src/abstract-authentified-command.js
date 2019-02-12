const { Command } = require('@oclif/command');
const authenticator = require('./services/authenticator');
const chalk = require('chalk');

class AbstractAuthentifiedCommand extends Command {
  async run() {
    if (!authenticator.getAuthToken()) {
      return this.error(`🔥  Please use ${chalk.bold('forest login')} to sign in to your Forest account. 🔥`, { exit: 10 });
    }

    try {
      const result = await this.runIfAuthentified();
      return result;
    } catch (error) {
      // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
      if (error.status === 403) {
        return this.error('💀  You do not have the right to execute this action on this project 💀');
      }

      throw error;
    }
  }

  async runIfAuthentified() {
    throw new Error(`'runIfAuthentified' is not implemented on ${this.constructor.name}`);
  }
}

module.exports = AbstractAuthentifiedCommand;
