import type { ConfigInterface, DbConfigInterface } from '../../interfaces/project-create-interface';
import type Dumper from '../../services/dumper/dumper';
import type DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';
import type * as Config from '@oclif/config';

import AbstractProjectCreateCommand from '../../abstract-project-create-command';

export default class CreateCommand extends AbstractProjectCreateCommand {
  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly dumper: Dumper;

  constructor(argv: string[], config: Config.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, databaseAnalyzer, dumper } = this.context;

    assertPresent({
      databaseAnalyzer,
      dumper,
    });

    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = dumper;
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
    const dumperConfig = {
      ...config.dbConfig,
      ...config.appConfig,
      forestAuthSecret: config.forestAuthSecret,
      forestEnvSecret: config.forestEnvSecret,
    };
    const dumpPromise = this.dumper.dump(schema, dumperConfig);
    await this.spinner.attachToPromise(dumpPromise);
  }
}
