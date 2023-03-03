import type { Config, ProcessedArguments } from '../../../interfaces/project-create-interface';
import type AgentNodeJsDumper from '../../../services/dumpers/agent-nodejs-dumper';
import type CommandGenerateConfigGetter from '../../../services/projects/create/command-generate-config-getter';
import type * as OclifConfig from '@oclif/config';

import { flags } from '@oclif/command';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import { sqlDbDialectOptions } from '../../../services/prompter/database-prompts';
import Agents from '../../../utils/agents';

export default class SqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: AgentNodeJsDumper;

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
  };

  static override readonly args = [...AbstractProjectCreateCommand.args];

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper, commandGenerateConfigGetter } = this.context;

    assertPresent({ agentNodejsDumper, commandGenerateConfigGetter });

    this.dumper = agentNodejsDumper;
    this.commandGenerateConfigGetter = commandGenerateConfigGetter;
  }

  protected async processArguments(programArguments: { [name: string]: any }): Promise<{
    config: ProcessedArguments;
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
    };
    const dumpPromise = this.dumper.dump(dumperConfig);
    await this.spinner.attachToPromise(dumpPromise);
  }

  protected get agent(): string {
    return this._agent;
  }
}
