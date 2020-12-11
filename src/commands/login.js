const { Command, flags } = require('@oclif/command');
const context = require('../context');

const { authenticator } = context.inject();

if (!authenticator) throw new Error('Missing dependency authenticator');

class LoginCommand extends Command {
  async run() {
    const { flags: config } = this.parse(LoginCommand);
    await authenticator.tryLogin(config);
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
