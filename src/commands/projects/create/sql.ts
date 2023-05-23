import type { ProjectCreateOptions } from '../../../abstract-project-create-command';
import type { Config } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type { CommandOptions } from '../../../utils/option-parser';
import type * as OclifConfig from '@oclif/config';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import Agents from '../../../utils/agents';
import languages from '../../../utils/languages';
import { optionsToFlags } from '../../../utils/option-parser';

export default class SqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: AgentNodeJs;

  private readonly _agent: string = Agents.NodeJS;

  protected static override readonly options: CommandOptions = {
    ...AbstractProjectCreateCommand.options,
    databaseDialect: {
      description: 'Enter your database dialect.',
      choices: ['mariadb', 'mssql', 'mysql', 'postgres'],
      exclusive: ['dbConnectionUrl'],
      oclif: { use: 'flag', char: 'd' },
    },
    databaseSchema: {
      description: 'Enter your database schema.',
      exclusive: ['dbConnectionUrl'],
      when: (args: ProjectCreateOptions) => !['mariadb', 'mysql'].includes(this.getDialect(args)),
      default: (args: ProjectCreateOptions) =>
        this.getDialect(args) === 'postgres' ? 'public' : '',
      oclif: { use: 'flag', char: 's' },
    },
    language: {
      description: 'Choose the language you want to use for your project.',
      choices: Object.values(languages).map(l => l.name),
      default: () => Object.values(languages)[0].name,
      oclif: { use: 'flag', char: 'l' },
    },
  };

  /** @see https://oclif.io/docs/commands */
  static override description = AbstractProjectCreateCommand.description;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper } = this.context;

    assertPresent({ agentNodejsDumper });

    this.dumper = agentNodejsDumper;
  }

  protected async generateProject(config: Config): Promise<void> {
    this.spinner.start({ text: 'Creating your project files' });
    const dumperConfig = {
      dbConfig: config.dbConfig,
      appConfig: config.appConfig,
      forestAuthSecret: config.forestAuthSecret,
      forestEnvSecret: config.forestEnvSecret,
      language: config.language,
    };
    const dumpPromise = this.dumper.dump(dumperConfig);
    await this.spinner.attachToPromise(dumpPromise);
  }

  protected get agent(): string {
    return this._agent;
  }
}
