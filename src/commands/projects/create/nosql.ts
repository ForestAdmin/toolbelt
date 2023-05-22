import type { CreateCommandArguments } from '../../../interfaces/command-create-project-arguments-interface';
import type { Config, DbConfig } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type DatabaseAnalyzer from '../../../services/schema/update/analyzer/database-analyzer';
import type * as OclifConfig from '@oclif/config';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import Agents from '../../../utils/agents';
import languages from '../../../utils/languages';
import { optionsToArgs, optionsToFlags } from '../../../utils/option-parser';

export default class NosqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: AgentNodeJs;

  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly _agent: string = Agents.NodeJS;

  protected static override readonly options: CommandOptions = {
    ...AbstractProjectCreateCommand.options,
    mongoDBSRV: {
      description: 'Use SRV DNS record for mongoDB connection.',
      choices: ['yes', 'no'],
      exclusive: ['dbConnectionUrl'],
      oclif: { use: 'flag', name: 'mongoDBSRV' },
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

  /** @see https://oclif.io/docs/args */
  static override readonly args = optionsToArgs(this.options);

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper, databaseAnalyzer } = this.context;

    assertPresent({ agentNodejsDumper, databaseAnalyzer });

    this.dumper = agentNodejsDumper;
    this.databaseAnalyzer = databaseAnalyzer;
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
