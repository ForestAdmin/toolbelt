const { flags } = require('@oclif/command');
const makeDefaultPlan = require('../context/init');
const AbstractCommand = require('../abstract-command');

class LoginCommand extends AbstractCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });
    this.authenticator = authenticator;
  }

  async run() {
    const { flags: config } = this.parse(LoginCommand);
    await this.authenticator.tryLogin(config);
  }
}

LoginCommand.description = 'Sign in with an existing account.';

LoginCommand.flags = {
  email: flags.string({
    char: 'e',
    description: 'Your Forest Admin account email.',
  }),
  password: flags.string({
    char: 'P',
    description: 'Your Forest Admin account password (ignored if token is set).',
  }),
  token: flags.string({
    char: 't',
    description: 'Your Forest Admin account token (replaces password).',
  }),
};

module.exports = LoginCommand;
