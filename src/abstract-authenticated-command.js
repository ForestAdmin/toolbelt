const { Command } = require('@oclif/command');
const context = require('./context');

const { chalk, logger, authenticator } = context.inject();

class AbstractAuthenticatedCommand extends Command {
  async run() {
    if (!authenticator.getAuthToken()) {
      logger.info('Login required.');
      await authenticator.tryLogin({});
      if (!authenticator.getAuthToken()) this.exit(10);
    }

    try {
      return await this.runIfAuthenticated();
    } catch (error) {
      // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
      if (error.status === 403) {
        logger.error('You do not have the right to execute this action on this project');
        return this.exit(2);
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
    logger.error(`Please use ${chalk.bold('forest login')} to sign in to your Forest account.`);
    this.exit(10);
  }
}

module.exports = AbstractAuthenticatedCommand;
