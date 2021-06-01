const jwt = require('jsonwebtoken');
const { Command } = require('@oclif/command');
const defaultPlan = require('../context/init');

class UserCommand extends Command {
  init(plan) {
    super.init(plan || defaultPlan);
    const {
      assertPresent, chalk, logger, authenticator,
    } = this.context;
    assertPresent({ chalk, logger, authenticator });

    this.chalk = chalk;
    this.logger = logger;
    this.authenticator = authenticator;
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
