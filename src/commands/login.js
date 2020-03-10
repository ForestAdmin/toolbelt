const { Command, flags } = require('@oclif/command');
const chalk = require('chalk');
const authenticator = require('../services/authenticator');
const logger = require('../services/logger');
const ERROR_UNEXPECTED = require('../utils/messages');

class LoginCommand extends Command {
  async run() {
    await authenticator
      .logout({ log: false });

    const { flags: config } = this.parse(LoginCommand);
    try {
      await authenticator.loginWithEmailOrTokenArgv(config);
      logger.info('Login successful');
    } catch (error) {
      const message = error.message === 'Unauthorized'
        ? 'Incorrect email or password.'
        : `${ERROR_UNEXPECTED} ${chalk.red(error)}`;
      this.error(message, { exit: false });
    }
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
