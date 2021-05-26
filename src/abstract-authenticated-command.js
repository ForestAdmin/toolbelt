const { Command } = require('@oclif/command');
const Context = require('@forestadmin/context');
const commonPlan = require('./context/init');

class AbstractAuthenticatedCommand extends Command {
  init(context) {
    this.context = context || Context.execute(commonPlan);
    const {
      assertPresent, logger, authenticator, chalk,
    } = this.context;
    assertPresent({ logger, authenticator, chalk });
    /** @protected @readonly */
    this.logger = logger;

    /** @protected @readonly */
    this.authenticator = authenticator;

    /** @protected @readonly */
    this.chalk = chalk;
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
