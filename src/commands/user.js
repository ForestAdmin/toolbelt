const { Command } = require('@oclif/command');
const jwt = require('jsonwebtoken');
const context = require('../context');
const authenticator = require('../services/authenticator');

const { chalk, logger } = context.inject();

class UserCommand extends Command {
  static async run() {
    const token = authenticator.getAuthToken();
    if (token) {
      const decoded = jwt.decode(token);
      console.log(chalk.bold('Email: ') + chalk.cyan(decoded.data.data.attributes.email));
    } else {
      logger.error('You are not logged.');
    }
  }
}

UserCommand.description = 'Display the current logged in user.';

module.exports = UserCommand;
