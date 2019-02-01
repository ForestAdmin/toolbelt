const { Command } = require('@oclif/command');
const chalk = require('chalk');
const authenticator = require('../services/authenticator');
const Prompter = require('../services/prompter');
const logger = require('../services/logger');

class LoginCommand extends Command {
  static async run() {
    await authenticator
      .logout({ log: false });

    const config = await Prompter([
      'email',
      'password',
    ]);

    try {
      await authenticator.login(config);
      console.log(chalk.green(`👍  You're now logged as ${config.email} 👍 `));
    } catch (error) {
      if (error.status) {
        logger.error('🔥  The email or password you entered is incorrect 🔥');
      } else {
        logger.error('💀  Oops, something went wrong.💀');
      }
    }
  }
}

LoginCommand.description = 'sign in with an existing account';

module.exports = LoginCommand;
