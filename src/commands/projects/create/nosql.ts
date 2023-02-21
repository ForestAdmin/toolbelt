import type {
  ConfigInterface,
  DbConfigInterface,
  ProcessedArgumentsInterface,
} from '../../../interfaces/project-create-interface';
import type Dumper from '../../../services/dumper/dumper';
import type CommandGenerateConfigGetter from '../../../services/projects/create/command-generate-config-getter';
import type DatabaseAnalyzer from '../../../services/schema/update/analyzer/database-analyzer';
import type * as Config from '@oclif/config';

import { flags } from '@oclif/command';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import { nosqlDbDialectOptions } from '../../../services/prompter/database-prompts';
import Agents from '../../../utils/agents';

export default class NosqlCommand extends AbstractProjectCreateCommand {
  private readonly dumper: Dumper;

  private readonly databaseAnalyzer: DatabaseAnalyzer;

  private readonly commandGenerateConfigGetter: CommandGenerateConfigGetter;

  private readonly _agent: string = Agents.NodeJS;

  static override readonly flags = {
    ...AbstractProjectCreateCommand.flags,
    databaseDialect: flags.string({
      char: 'd',
      dependsOn: [],
      description: 'Enter your database dialect.',
      exclusive: ['databaseConnectionURL'],
      options: nosqlDbDialectOptions.map(option => option.value),
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

  constructor(argv: string[], config: Config.IConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, dumper, databaseAnalyzer, commandGenerateConfigGetter } = this.context;

    assertPresent({ dumper, databaseAnalyzer, commandGenerateConfigGetter });

    this.dumper = dumper;
    this.databaseAnalyzer = databaseAnalyzer;
    this.commandGenerateConfigGetter = commandGenerateConfigGetter;
  }

  protected async processArguments(programArguments: { [name: string]: any }): Promise<{
    config: ProcessedArgumentsInterface;
    specificDatabaseConfig: { [name: string]: any };
  }> {
    const config = await this.commandGenerateConfigGetter.get(programArguments, true, true);

    const specificDatabaseConfig = {
      mongodbSrv: config.mongoDBSRV,
    };

    return { config, specificDatabaseConfig };
  }

  protected async generateProject(config: ConfigInterface): Promise<void> {
    const schema = await this.analyzeDatabase(config.dbConfig);
    await this.createFiles(config, schema);
  }

  protected get agent(): string {
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

  private async createFiles(config: ConfigInterface, schema): Promise<void> {
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
