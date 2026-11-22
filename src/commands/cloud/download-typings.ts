import type * as Config from '@oclif/config';

import { flags } from '@oclif/command';
import chalk from 'chalk';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';

export default class DownloadTypingsCommand extends AbstractAuthenticatedCommand {
  private env: { FOREST_SERVER_URL: string; FOREST_ENV_SECRET: string };

  static override flags = {
    format: flags.string({
      char: 'o',
      description: 'Output path',
      default: './typings.d.ts',
    }),
  };

  static override description = 'Download typings from your cloud project';

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
    const parsed = this.parse(DownloadTypingsCommand);

    //    const config = { ...this.env, ...parsed.flags, ...(parsed.args as { projectId: string }) };
    this.logger.info(chalk.bgGreenBright(`Downloading typings`));
  }
}
