const jwt = require('jsonwebtoken');
const makeDefaultPlan = require('../context/init');
const AbstractCommand = require('../abstract-command');

class UserCommand extends AbstractCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
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
