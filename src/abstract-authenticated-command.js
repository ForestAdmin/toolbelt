const { Command } = require('@oclif/command');
const context = require('@forestadmin/context');

class AbstractAuthenticatedCommand extends Command {
  constructor(...args) {
    super(...args);
    /** @type {import('./context/init').Context} */
    const { logger, authenticator, chalk } = context.inject();

    /** @protected @readonly */
    this.logger = logger;

    /** @protected @readonly */
    this.authenticator = authenticator;

    /** @protected @readonly */
    this.chalk = chalk;

    ['logger', 'authenticator', 'chalk'].forEach((name) => {
      if (!this[name]) throw new Error(`Missing dependency ${name}`);
    });
  }

  async run() {
    if (!this.authenticator.getAuthToken()) {
      this.logger.info('Login required.');
      await this.authenticator.tryLogin({});
      if (!this.authenticator.getAuthToken()) this.exit(10);
    }

    try {
      return await this.runIfAuthenticated();
    } catch (error) {
      // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
      if (error.status === 403) {
        this.logger.error('You do not have the right to execute this action on this project');
        return this.exit(2);
      }

      if (error.status === 401) {
        await this.authenticator.logout();
        return this.displayLoginMessageAndQuit();
      }

      throw error;
    }
  }

  async runIfAuthenticated() {
    throw new Error(`'runIfAuthenticated' is not implemented on ${this.constructor.name}`);
  }

  displayLoginMessageAndQuit() {
    this.logger.error(`Please use ${this.chalk.bold('forest login')} to sign in to your Forest account.`);
    this.exit(10);
  }
}

module.exports = AbstractAuthenticatedCommand;
