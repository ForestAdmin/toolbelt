import type { CreateCommandArguments } from '../../../interfaces/command-create-project-arguments-interface';
import type { Config, DbConfig } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type CommandGenerateConfigGetter from '../../../services/projects/create/command-generate-config-getter';
import type DatabaseAnalyzer from '../../../services/schema/update/analyzer/database-analyzer';
import type * as OclifConfig from '@oclif/config';

import { flags } from '@oclif/command';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import { nosqlDbDialectOptions } from '../../../services/prompter/database-prompts';
import Agents from '../../../utils/agents';

export default class NosqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: AgentNodeJs;

  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly commandGenerateConfigGetter: CommandGenerateConfigGetter;

  private readonly _agent: string = Agents.NodeJS;

  static override readonly flags = {
    ...AbstractProjectCreateCommand.flags,
    mongoDBSRV: flags.boolean({
      dependsOn: [],
      description: 'Use SRV DNS record for mongoDB connection.',
      exclusive: ['databaseConnectionURL'],
      required: false,
    }),
    javascript: flags.boolean({
      description: 'Generate your project in javascript.',
      exclusive: ['typescript'],
      default: context => !context.flags.typescript,
    }),
    typescript: flags.boolean({
      description: 'Generate your project in typescript.',
      exclusive: ['javascript'],
      default: false,
    }),
  };

  static override readonly args = [...AbstractProjectCreateCommand.args];

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper, databaseAnalyzer, commandGenerateConfigGetter } =
      this.context;

    assertPresent({ agentNodejsDumper, databaseAnalyzer, commandGenerateConfigGetter });

    this.dumper = agentNodejsDumper;
    this.databaseAnalyzer = databaseAnalyzer;
    this.commandGenerateConfigGetter = commandGenerateConfigGetter;
  }

  protected async getConfigFromArguments(programArguments: { [name: string]: any }): Promise<{
    config: CreateCommandArguments;
    specificDatabaseConfig: { [name: string]: any };
  }> {
    const config = await this.commandGenerateConfigGetter.get(programArguments, false, true);

    const specificDatabaseConfig = {
      mongodbSrv: config.mongoDBSRV,
    };

    return { config, specificDatabaseConfig };
  }

  protected async generateProject(config: Config): Promise<void> {
    const schema = await this.analyzeDatabase(config.dbConfig);
    await this.createFiles(config, schema);
  }

  protected get agent(): string {
    return this._agent;
  }

  private async analyzeDatabase(dbConfig: DbConfig) {
    this.logger.info('Analyzing the database');
    const connection = await this.database.connect(dbConfig);
    const schema = await this.databaseAnalyzer.analyzeMongoDb(connection, dbConfig, true);
    await this.database.disconnect(connection);
    this.logger.success('Database is analyzed', { lineColor: 'green' });
    return schema;
  }

  private async createFiles(config: Config, schema): Promise<void> {
    this.spinner.start({ text: 'Creating your project files' });
    const dumperConfig = {
      dbConfig: config.dbConfig,
      appConfig: config.appConfig,
      forestAuthSecret: config.forestAuthSecret,
      forestEnvSecret: config.forestEnvSecret,
      language: config.language,
    };
    const dumpPromise = this.dumper.dump(dumperConfig, schema);
    await this.spinner.attachToPromise(dumpPromise);
  }
}
