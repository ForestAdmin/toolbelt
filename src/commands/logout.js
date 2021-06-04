const AbstractCommand = require('../abstract-command');
const makeDefaultPlan = require('../context/init');

class LogoutCommand extends AbstractCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });
    this.authenticator = authenticator;
  }

  async run() {
    await this.authenticator.logout({ log: true });
  }
}

LogoutCommand.description = 'Sign out of your account.';

module.exports = LogoutCommand;
