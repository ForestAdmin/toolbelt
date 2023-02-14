import AbstractProjectCreateCommand, {
  ConfigInterface,
  DbConfigInterface,
} from '../../abstract-project-create-command';
import Dumper from '../../services/dumper/dumper';
import DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';

export default class CreateCommand extends AbstractProjectCreateCommand {
  private databaseAnalyzer: DatabaseAnalyzer;

  private dumper: Dumper;

  // Flags, args and Description must be defined on the class itself otherwise it cannot be parsed properly
  static override flags = AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().flags;

  static override args = AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().args;

  static override description =
    AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().description;

  constructor(argv, config, plan) {
    super(argv, config, plan);

    const { assertPresent, databaseAnalyzer, dumper } = this.context;

    assertPresent({
      databaseAnalyzer,
      dumper,
    });

    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = dumper;
  }

  async run() {
    await this.checkAuthentication();

    const config = await this.createProject(CreateCommand);

    const schema = await this.analyzeDatabase(config.dbConfig);

    await this.createFiles(config, schema);

    await this.notifySuccess();
  }

  async analyzeDatabase(dbConfig: DbConfigInterface) {
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

  async createFiles(config: ConfigInterface, schema) {
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
