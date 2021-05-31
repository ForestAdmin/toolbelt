const Context = require('@forestadmin/context');
const AbstractCommand = require('../abstract-command');
const plan = require('../context/init');

class LogoutCommand extends AbstractCommand {
  init(context) {
    this.context = context || Context.execute(plan);
    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });

    this.authenticator = authenticator;
    super.init();
  }

  async run() {
    await this.authenticator.logout({ log: true });
  }
}

LogoutCommand.description = 'Sign out of your account.';

module.exports = LogoutCommand;
