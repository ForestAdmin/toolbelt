import type { CreateCommandArguments } from '../../../interfaces/command-create-project-arguments-interface';
import type { Config } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type CommandGenerateConfigGetter from '../../../services/projects/create/command-generate-config-getter';
import type * as OclifConfig from '@oclif/config';

import { flags } from '@oclif/command';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import { sqlDbDialectOptions } from '../../../services/prompter/database-prompts';
import Agents from '../../../utils/agents';
import languages from '../../../utils/languages';

export default class SqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: AgentNodeJs;

  private readonly commandGenerateConfigGetter: CommandGenerateConfigGetter;

  private readonly _agent: string = Agents.NodeJS;

  static override readonly flags = {
    ...AbstractProjectCreateCommand.flags,
    databaseDialect: flags.string({
      char: 'd',
      dependsOn: [],
      description: 'Enter your database dialect.',
      exclusive: ['databaseConnectionURL'],
      options: sqlDbDialectOptions.map(option => option.value),
      required: false,
    }),
    databaseSchema: flags.string({
      char: 's',
      dependsOn: [],
      description: 'Enter your database schema.',
      exclusive: [],
      required: false,
    }),
    language: flags.string({
      char: 'l',
      description: 'Choose the language you want to use for your project.',
      options: Object.values(languages).map(language => language.name),
      required: true,
    }),
  };

  static override readonly args = [...AbstractProjectCreateCommand.args];

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper, commandGenerateConfigGetter } = this.context;

    assertPresent({ agentNodejsDumper, commandGenerateConfigGetter });

    this.dumper = agentNodejsDumper;
    this.commandGenerateConfigGetter = commandGenerateConfigGetter;
  }

  protected async getConfigFromArguments(programArguments: { [name: string]: any }): Promise<{
    config: CreateCommandArguments;
    specificDatabaseConfig: { [name: string]: any };
  }> {
    const config = await this.commandGenerateConfigGetter.get(programArguments, true, false);

    const specificDatabaseConfig = {};

    return { config, specificDatabaseConfig };
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
