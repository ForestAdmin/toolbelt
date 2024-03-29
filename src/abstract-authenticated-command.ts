import type Authenticator from './services/authenticator';
import type { Config } from '@oclif/core';

import AbstractCommand from './abstract-command';

export default abstract class AbstractAuthenticatedCommand extends AbstractCommand {
  protected readonly authenticator: Authenticator;

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);

    const { assertPresent, authenticator } = this.context;
    assertPresent({ authenticator });

    this.authenticator = authenticator;
  }

  async run(): Promise<void> {
    await this.checkAuthentication();
    try {
      await this.runAuthenticated();
    } catch (error) {
      await this.handleAuthenticationErrors(error);
    }
  }

  protected abstract runAuthenticated(): Promise<void>;

  private async checkAuthentication(): Promise<void> {
    if (!this.authenticator.getAuthToken()) {
      this.logger.info('Login required.');
      await this.authenticator.tryLogin({});
      if (!this.authenticator.getAuthToken()) {
        this.exit(10);
      }
    }
  }

  // Authentication error handler.
  private async handleAuthenticationErrors(error): Promise<void> {
    // NOTICE: Due to ip-whitelist, 404 will never be thrown for a project
    if (error.status === 403) {
      this.logger.error('You do not have the right to execute this action on this project');
      return this.exit(2);
    }
    if (error.status === 401) {
      await this.authenticator.logout();
      this.logger.error(
        `Please use '${this.chalk.bold('forest login')}' to sign in to your Forest account.`,
      );
      return this.exit(10);
    }
    return super.catch(error);
  }
}
