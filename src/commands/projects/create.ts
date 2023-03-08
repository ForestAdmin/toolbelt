import type { ConfigInterface, DbConfigInterface } from '../../interfaces/project-create-interface';
import type ForestExpressDumper from '../../services/dumpers/forest-express';
import type DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';
import type * as Config from '@oclif/config';

import AbstractProjectCreateCommand from '../../abstract-project-create-command';

export default class CreateCommand extends AbstractProjectCreateCommand {
  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly dumper: ForestExpressDumper;

  constructor(argv: string[], config: Config.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, databaseAnalyzer, forestExpressDumper } = this.context;

    assertPresent({
      databaseAnalyzer,
      forestExpressDumper,
    });

    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = forestExpressDumper;
  }

  async generateProject(config: ConfigInterface) {
    const schema = await this.analyzeDatabase(config.dbConfig);
    await this.createFiles(config, schema);
  }

  private async analyzeDatabase(dbConfig: DbConfigInterface) {
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

  private async createFiles(config: ConfigInterface, schema) {
    this.spinner.start({ text: 'Creating your project files' });
    const dumpPromise = this.dumper.dump(config, schema);
    await this.spinner.attachToPromise(dumpPromise);
  }
}
