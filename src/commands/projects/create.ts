import type { Config, DbConfig } from '../../interfaces/project-create-interface';
import type ForestExpress from '../../services/dumpers/forest-express';
import type DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';
import type { CommandOptions } from '../../utils/option-parser';
import type * as OclifConfig from '@oclif/config';

import AbstractProjectCreateCommand from '../../abstract-project-create-command';
import * as projectCreateOptions from '../../services/projects/create/options';
import { optionsToFlags } from '../../utils/option-parser';

export default class CreateCommand extends AbstractProjectCreateCommand {
  protected static readonly options: CommandOptions = {
    databaseConnectionURL: projectCreateOptions.databaseConnectionURL,
    databaseDialect: projectCreateOptions.databaseDialectV1,
    databaseName: projectCreateOptions.databaseName,
    databaseSchema: projectCreateOptions.databaseSchema,
    databaseHost: projectCreateOptions.databaseHost,
    databasePort: projectCreateOptions.databasePort,
    databaseUser: projectCreateOptions.databaseUser,
    databasePassword: projectCreateOptions.databasePassword,
    databaseSSL: projectCreateOptions.databaseSSL,
    mongoDBSRV: projectCreateOptions.mongoDBSRV,
    applicationHost: projectCreateOptions.applicationHost,
    applicationPort: projectCreateOptions.applicationPort,
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly dumper: ForestExpress;

  protected readonly agent = null;

  constructor(argv: string[], config: OclifConfig.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, databaseAnalyzer, forestExpressDumper } = this.context;
    assertPresent({ databaseAnalyzer, forestExpressDumper });

    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = forestExpressDumper;
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
