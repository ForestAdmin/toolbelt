import type { ConfigInterface } from '../../../interfaces/project-create-interface';
import type Dumper from '../../../services/dumper/dumper';
import type * as Config from '@oclif/config';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import Agents from '../../../utils/agents';

export default class SqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: Dumper;

  private readonly _agent: string = Agents.NodeJS;

  constructor(argv: string[], config: Config.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, dumper } = this.context;

    assertPresent({ dumper });

    this.dumper = dumper;
  }

  protected async generateProject(config: ConfigInterface) {
    this.spinner.start({ text: 'Creating your project files' });
    const dumperConfig = {
      ...config.dbConfig,
      ...config.appConfig,
      forestAuthSecret: config.forestAuthSecret,
      forestEnvSecret: config.forestEnvSecret,
    };
    const dumpPromise = this.dumper.dump({}, dumperConfig);
    await this.spinner.attachToPromise(dumpPromise);
  }

  protected get agent() {
    return this._agent;
  }
}
