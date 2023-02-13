const AbstractCommand = require('../abstract-command').default;

class LogoutCommand extends AbstractCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
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
