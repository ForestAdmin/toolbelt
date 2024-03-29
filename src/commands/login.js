const { Flags } = require('@oclif/core');
const AbstractCommand = require('../abstract-command').default;

class LoginCommand extends AbstractCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });
    this.authenticator = authenticator;
  }

  async run() {
    const { flags: config } = await this.parse(LoginCommand);
    await this.authenticator.tryLogin(config);
  }
}

LoginCommand.description = 'Sign in with an existing account.';

LoginCommand.flags = {
  email: Flags.string({
    char: 'e',
    description: 'Your Forest Admin account email.',
  }),
  password: Flags.string({
    char: 'P',
    description: 'Your Forest Admin account password (ignored if token is set).',
  }),
  token: Flags.string({
    char: 't',
    description: 'Your Forest Admin account token (replaces password).',
  }),
};

module.exports = LoginCommand;
