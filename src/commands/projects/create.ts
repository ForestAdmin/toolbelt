import type { ConfigInterface, DbConfigInterface } from '../../interfaces/project-create-interface';
import type DumperV1 from '../../services/dumpers/dumper-v1';
import type DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';
import type * as Config from '@oclif/config';

import AbstractProjectCreateCommand from '../../abstract-project-create-command';

export default class CreateCommand extends AbstractProjectCreateCommand {
  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly dumper: DumperV1;

  constructor(argv: string[], config: Config.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, databaseAnalyzer, dumperV1 } = this.context;

    assertPresent({
      databaseAnalyzer,
      dumperV1,
    });

    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = dumperV1;
  }

  async generateProject(config: ConfigInterface) {
    const schema = await this.analyzeDatabase(config.dbConfig);
    await this.createFiles(config, schema);
  }

  private async analyzeDatabase(dbConfig: DbConfigInterface) {
    let schema = {};

    this.spinner.start({ text: 'Analyzing the database' });
    const connection = await this.database.connect(dbConfig);

    if (dbConfig.dbDialect === 'mongodb') {
      // the mongodb analyzer display a progress bar during the analysis
      schema = await this.databaseAnalyzer.analyzeMongoDb(connection, dbConfig, true);
    } else {
      const schemaPromise = this.databaseAnalyzer.analyze(connection, dbConfig, true);
      schema = await this.spinner.attachToPromise(schemaPromise);
    }

    await this.database.disconnect(connection);
    this.logger.success('Database is analyzed', { lineColor: 'green' });

    return schema;
  }

  private async createFiles(config: ConfigInterface, schema) {
    this.spinner.start({ text: 'Creating your project files' });
    const dumpPromise = this.dumper.dump(config, schema);
    await this.spinner.attachToPromise(dumpPromise);
  }
}
