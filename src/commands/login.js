const { Command, flags } = require('@oclif/command');
const context = require('../context');

class LoginCommand extends Command {
  constructor(...args) {
    super(...args);
    /** @type {import('../context/init').Context} */
    const { authenticator } = context.inject();

    /** @private @readonly */
    this.authenticator = authenticator;

    if (!this.authenticator) throw new Error('Missing dependency authenticator');
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
