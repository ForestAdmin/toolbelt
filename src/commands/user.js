const jwt = require('jsonwebtoken');
const { Command } = require('@oclif/command');
const context = require('@forestadmin/context');

class UserCommand extends Command {
  constructor(...args) {
    super(...args);

    /** @type {import('../context/init').Context} */
    const { chalk, logger, authenticator } = context.inject();

    this.chalk = chalk;
    this.logger = logger;
    this.authenticator = authenticator;

    ['chalk', 'logger', 'authenticator'].forEach((name) => {
      if (!this[name]) throw new Error(`Missing dependency ${name}`);
    });
  }

  async run() {
    const token = this.authenticator.getAuthToken();
    if (token) {
      const decoded = jwt.decode(token);
      console.log(this.chalk.bold('Email: ') + this.chalk.cyan(decoded.data.data.attributes.email));
    } else {
      this.logger.error('You are not logged.');
    }
  }
}

UserCommand.description = 'Display the current logged in user.';

module.exports = UserCommand;
