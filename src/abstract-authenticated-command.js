const AbstractCommand = require('./abstract-command');
const makeDefaultPlan = require('./context/init');

class AbstractAuthenticatedCommand extends AbstractCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });

    /** @protected @readonly */
    this.authenticator = authenticator;
  }

  async run() {
    if (!this.authenticator.getAuthToken()) {
      this.logger.info('Login required.');
      await this.authenticator.tryLogin({});
      if (!this.authenticator.getAuthToken()) {
        this.exit(10);
      }
    }

    try {
      return await this.runIfAuthenticated();
    } catch (error) {
      // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
      if (error.status === 403) {
        this.logger.error('You do not have the right to execute this action on this project');
        this.exit(2);
      }

      if (error.status === 401) {
        await this.authenticator.logout();
        this.logger.error(`Please use ${this.chalk.bold('forest login')} to sign in to your Forest account.`);
        this.exit(10);
      }

      throw error;
    }
  }

  async runIfAuthenticated() {
    throw new Error(`'runIfAuthenticated' is not implemented on ${this.constructor.name}`);
  }
}

module.exports = AbstractAuthenticatedCommand;
