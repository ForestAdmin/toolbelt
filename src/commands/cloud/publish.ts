import type * as Config from '@oclif/config';

import { flags } from '@oclif/command';
import chalk from 'chalk';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';

export default class PublishCommand extends AbstractAuthenticatedCommand {
  private env: { FOREST_SERVER_URL: string; FOREST_ENV_SECRET: string };

  static override description = 'Publish your code';

  constructor(argv: string[], config: Config.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, env, projectRenderer } = this.context;
    assertPresent({
      env,
      projectRenderer,
    });

    this.env = env;
  }

  async runAuthenticated() {
    const parsed = this.parse(PublishCommand);
    //    const config = { ...this.env, ...parsed.flags, ...(parsed.args as { projectId: string }) };
    this.logger.info(chalk.bgGreenBright('publishing code to lambda'));
  }
}
