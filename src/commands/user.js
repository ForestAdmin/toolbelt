const AbstractCommand = require('../abstract-command').default;

class UserCommand extends AbstractCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, authenticator, chalk, jwtDecode, logger, terminator } = this.context;
    assertPresent({
      authenticator,
      chalk,
      jwtDecode,
      logger,
      terminator,
    });

    this.authenticator = authenticator;
    this.chalk = chalk;
    this.jwtDecode = jwtDecode;
    this.logger = logger;
    this.terminator = terminator;
  }

  async run() {
    const token = this.authenticator.getAuthToken();
    if (token) {
      const decoded = this.jwtDecode(token);
      const { email } = decoded.data.data.attributes;
      this.logger.info(
        `${this.chalk.bold('Email:')} ${this.chalk.cyan(email)} (connected with${
          decoded.organizationId ? '' : 'out'
        } SSO)`,
      );
    } else {
      return this.terminator.terminate(1, { logs: ['You are not logged.'] });
    }
    return Promise.resolve();
  }

  async catch(error) {
    await this.handleAuthenticationErrors(error);
    return super.catch(error);
  }
}

UserCommand.description = 'Display the current logged in user.';

module.exports = UserCommand;
