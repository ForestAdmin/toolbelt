import type * as Config from '@oclif/config';
import Authenticator from './services/authenticator';
import AbstractCommand from './abstract-command';

export default abstract class AbstractAuthenticatedCommand extends AbstractCommand {
  protected authenticator: Authenticator;

  constructor(argv: string[], config: Config.IConfig, plan?: any) {
    super(argv, config, plan);

    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });

    this.authenticator = authenticator;
  }

  async checkAuthentication() {
    if (!this.authenticator.getAuthToken()) {
      this.logger.info('Login required.');
      await this.authenticator.tryLogin({});
      if (!this.authenticator.getAuthToken()) {
        this.exit(10);
      }
    }
  }

  // Authentication error handler.
  async handleAuthenticationErrors(error) {
    // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
    if (error.status === 403) {
      this.logger.error('You do not have the right to execute this action on this project');
      this.exit(2);
    }

    if (error.status === 401) {
      await this.authenticator.logout();
      this.logger.error(
        `Please use '${this.chalk.bold('forest login')}' to sign in to your Forest account.`,
      );
      this.exit(10);
    }
  }
}
