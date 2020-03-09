const { Command, flags } = require('@oclif/command');
const authenticator = require('../services/authenticator');
const logger = require('../services/logger');

class LoginCommand extends Command {
  async run() {
    await authenticator
      .logout({ log: false });

    const { flags } = this.parse(LoginCommand);
    await authenticator.loginWithEmailOrTokenArgv(flags);

    logger.info('Login successful');
  }
}

LoginCommand.description = 'sign in with an existing account';

LoginCommand.flags = {
  email: flags.string({
    char: 'e',
    description: 'Your Forest Admin account email',
  }),
  password: flags.string({
    char: 'P',
    description: 'Your Forest Admin account password (ignored if token is set)',
  }),
  token: flags.string({
    char: 't',
    description: 'Your Forest Admin account token (replaces password)',
  }),
};

module.exports = LoginCommand;
