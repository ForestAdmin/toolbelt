import type { Config, DbConfig } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type { ProjectCreateOptions } from '../../../services/projects/create/options';
import type DatabaseAnalyzer from '../../../services/schema/update/analyzer/database-analyzer';
import type { CommandOptions } from '../../../utils/option-parser';
import type * as OclifConfig from '@oclif/config';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import * as projectCreateOptions from '../../../services/projects/create/options';
import Agents from '../../../utils/agents';
import { optionsToFlags } from '../../../utils/option-parser';

export default class NosqlCommand extends AbstractProjectCreateCommand {
  protected static readonly options: CommandOptions = {
    databaseConnectionURL: projectCreateOptions.databaseConnectionURL,
    databaseName: projectCreateOptions.databaseName,
    databaseHost: projectCreateOptions.databaseHost,
    databasePort: projectCreateOptions.databasePort,
    databaseUser: projectCreateOptions.databaseUser,
    databasePassword: projectCreateOptions.databasePassword,
    databaseSSL: projectCreateOptions.databaseSSL,
    mongoDBSRV: projectCreateOptions.mongoDBSRV,
    applicationHost: projectCreateOptions.applicationHost,
    applicationPort: projectCreateOptions.applicationPort,
    language: projectCreateOptions.language,
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  private readonly dumper: AgentNodeJs;

  private readonly databaseAnalyzer: DatabaseAnalyzer;

  protected readonly agent = Agents.NodeJS;

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper, databaseAnalyzer } = this.context;

    assertPresent({ agentNodejsDumper, databaseAnalyzer });

    this.dumper = agentNodejsDumper;
    this.databaseAnalyzer = databaseAnalyzer;
  }

  protected async generateProject(config: Config): Promise<void> {
    const schema = await this.analyzeDatabase(config.dbConfig);
    await this.createFiles(config, schema);
  }

  protected override async getCommandOptions(): Promise<ProjectCreateOptions> {
    const options = await super.getCommandOptions();
    options.databaseDialect = 'mongodb';

    return options;
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
