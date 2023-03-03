import type {
  Config,
  DbConfig,
  ProcessedArguments,
} from '../../interfaces/project-create-interface';
import type ForestExpress from '../../services/dumpers/forest-express';
import type DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';
import type * as OclifConfig from '@oclif/config';

import { flags } from '@oclif/command';

import AbstractProjectCreateCommand from '../../abstract-project-create-command';
import {
  nosqlDbDialectOptions,
  sqlDbDialectOptions,
} from '../../services/prompter/database-prompts';

export default class CreateCommand extends AbstractProjectCreateCommand {
  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly dumper: ForestExpress;

  private readonly commandGenerateConfigGetter: CommandGenerateConfigGetter;

  private readonly _agent: string | null = null;

  static override readonly flags = {
    ...AbstractProjectCreateCommand.flags,
    databaseDialect: flags.string({
      char: 'd',
      dependsOn: [],
      description: 'Enter your database dialect.',
      exclusive: ['databaseConnectionURL'],
      options: [...nosqlDbDialectOptions, ...sqlDbDialectOptions].map(option => option.value),
      required: false,
    }),
    databaseSchema: flags.string({
      char: 's',
      dependsOn: [],
      description: 'Enter your database schema.',
      exclusive: [],
      required: false,
    }),
    mongoDBSRV: flags.boolean({
      dependsOn: [],
      description: 'Use SRV DNS record for mongoDB connection.',
      exclusive: ['databaseConnectionURL'],
      required: false,
    }),
  };

  static override readonly args = [...AbstractProjectCreateCommand.args];

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, databaseAnalyzer, forestExpressDumper, commandGenerateConfigGetter } = this.context;

    assertPresent({
      databaseAnalyzer,
      forestExpressDumper,
      commandGenerateConfigGetter,
    });

    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = forestExpressDumper;
    this.commandGenerateConfigGetter = commandGenerateConfigGetter;
  }

  protected async processArguments(programArguments: { [name: string]: any }): Promise<{
    config: ProcessedArguments;
    specificDatabaseConfig: { [name: string]: any };
  }> {
    const config = await this.commandGenerateConfigGetter.get(programArguments, true, true);

    const specificDatabaseConfig = {
      mongodbSrv: config.mongoDBSRV,
    };

    return { config, specificDatabaseConfig };
  }

  protected async generateProject(config: Config): Promise<void> {
    const schema = await this.analyzeDatabase(config.dbConfig);
    await this.createFiles(config, schema);
  }

  protected get agent(): string | null {
    return this._agent;
  }

  private async analyzeDatabase(dbConfig: DbConfig) {
    const connection = await this.database.connect(dbConfig);

    if (dbConfig.dbDialect === 'mongodb') {
      // the mongodb analyzer display a progress bar during the analysis
      this.logger.info('Analyzing the database');
      const schema = await this.databaseAnalyzer.analyzeMongoDb(connection, dbConfig, true);
      await this.database.disconnect(connection);
      this.logger.success('Database is analyzed', { lineColor: 'green' });
      return schema;
    }

    this.spinner.start({ text: 'Analyzing the database' });
    const schemaPromise = this.databaseAnalyzer.analyze(connection, dbConfig, true);
    const schema = await this.spinner.attachToPromise(schemaPromise);
    this.logger.success('Database is analyzed', { lineColor: 'green' });
    await this.database.disconnect(connection);
    return schema;
  }

  private async createFiles(config: Config, schema): Promise<void> {
    this.spinner.start({ text: 'Creating your project files' });
    const dumpPromise = this.dumper.dump(config, schema);
    await this.spinner.attachToPromise(dumpPromise);
  }
}
