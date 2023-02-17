import type {
  ConfigInterface,
  DbConfigInterface,
} from '../../../interfaces/project-create-interface';
import type Dumper from '../../../services/dumper/dumper';
import type DatabaseAnalyzer from '../../../services/schema/update/analyzer/database-analyzer';
import type * as Config from '@oclif/config';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import Agents from '../../../utils/agents';

export default class NosqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: Dumper;

  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly _agent: string = Agents.NodeJS;

  constructor(argv: string[], config: Config.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, dumper, databaseAnalyzer } = this.context;

    assertPresent({ dumper, databaseAnalyzer });

    this.dumper = dumper;
    this.databaseAnalyzer = databaseAnalyzer;
  }

  protected async generateProject(config: ConfigInterface) {
    const schema = await this.analyzeDatabase(config.dbConfig);
    await this.createFiles(config, schema);
  }

  protected get agent() {
    return this._agent;
  }

  private async analyzeDatabase(dbConfig: DbConfigInterface) {
    let schema = {};

    this.spinner.start({ text: 'Analyzing the database' });
    const connection = await this.database.connect(dbConfig);

    if (dbConfig.dbDialect === 'mongodb') {
      // the mongodb analyzer display a progress bar during the analysis
      schema = await this.databaseAnalyzer.analyzeMongoDb(connection, dbConfig, true);
    }

    await this.database.disconnect(connection);
    this.logger.success('Database is analyzed', { lineColor: 'green' });

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
