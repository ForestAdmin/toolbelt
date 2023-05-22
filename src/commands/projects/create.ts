import type { CreateCommandArguments } from '../../interfaces/command-create-project-arguments-interface';
import type { Config, DbConfig } from '../../interfaces/project-create-interface';
import type ForestExpress from '../../services/dumpers/forest-express';
import type DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';
import type { CommandOptions } from '../../utils/option-parser';
import type * as OclifConfig from '@oclif/config';

import AbstractProjectCreateCommand from '../../abstract-project-create-command';
import { optionsToArgs, optionsToFlags } from '../../utils/option-parser';

export default class CreateCommand extends AbstractProjectCreateCommand {
  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly dumper: ForestExpress;

  protected readonly agent: string | null = null;

  protected static override readonly options: CommandOptions = {
    ...AbstractProjectCreateCommand.options,
    dbDialect: {
      description: 'Enter your database dialect.',
      choices: ['mariadb', 'mssql', 'mysql', 'postgres'],
      exclusive: ['dbConnectionUrl'],
      oclif: { use: 'flag', char: 'd', name: 'databaseDialect' },
    },
    dbSchema: {
      description: 'Enter your database schema.',
      exclusive: ['dbConnectionUrl'],
      // when: (args: Options) => !['mariadb', 'mysql'].includes(this.getDialect(args)),
      // default: (args: Options) => (this.getDialect(args) === 'postgres' ? 'public' : ''),
      oclif: { use: 'flag', char: 's', name: 'databaseSchema' },
    },
    mongoDBSRV: {
      description: 'Use SRV DNS record for mongoDB connection.',
      choices: ['yes', 'no'],
      exclusive: ['dbConnectionUrl'],
      oclif: { use: 'flag', name: 'mongoDBSRV' },
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

    const { assertPresent, databaseAnalyzer, forestExpressDumper, commandGenerateConfigGetter } =
      this.context;

    assertPresent({
      databaseAnalyzer,
      forestExpressDumper,
      commandGenerateConfigGetter,
    });

    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = forestExpressDumper;
  }

  protected async getConfigFromArguments(programArguments: { [name: string]: any }): Promise<{
    config: CreateCommandArguments;
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
