import { flags } from '@oclif/command';
import { dbDialectOptions } from '../../services/prompter/database-prompts';
import AbstractProjectCreateCommand, {
  ConfigInterface,
  DbConfigInterface,
} from '../../abstract-project-create-command';
import Dumper from '../../services/dumper/dumper';
import DatabaseAnalyzer from '../../services/schema/update/analyzer/database-analyzer';

export default class CreateCommand extends AbstractProjectCreateCommand {
  private databaseAnalyzer: DatabaseAnalyzer;

  private dumper: Dumper;

  static override flags = {
    applicationHost: flags.string({
      char: 'H',
      dependsOn: [],
      description: 'Hostname of your admin backend application.',
      exclusive: [],
      required: false,
    }),
    applicationPort: flags.integer({
      char: 'P',
      dependsOn: [],
      description: 'Port of your admin backend application.',
      exclusive: [],
      required: false,
    }),
    databaseConnectionURL: flags.string({
      char: 'c',
      dependsOn: [],
      description: 'Enter the database credentials with a connection URL.',
      exclusive: ['ssl'],
      required: false,
    }),
    databaseDialect: flags.string({
      char: 'd',
      dependsOn: [],
      description: 'Enter your database dialect.',
      exclusive: ['databaseConnectionURL'],
      options: dbDialectOptions.map(option => option.value),
      required: false,
    }),
    databaseName: flags.string({
      char: 'n',
      dependsOn: [],
      description: 'Enter your database name.',
      exclusive: ['databaseConnectionURL'],
      required: false,
    }),
    databaseHost: flags.string({
      char: 'h',
      dependsOn: [],
      description: 'Enter your database host.',
      exclusive: ['databaseConnectionURL'],
      required: false,
    }),
    databasePort: flags.integer({
      char: 'p',
      dependsOn: [],
      description: 'Enter your database port.',
      exclusive: ['databaseConnectionURL'],
      required: false,
    }),
    databaseUser: flags.string({
      char: 'u',
      dependsOn: [],
      description: 'Enter your database user.',
      exclusive: ['databaseConnectionURL'],
      required: false,
    }),
    databasePassword: flags.string({
      dependsOn: [],
      description: 'Enter your database password.',
      exclusive: ['databaseConnectionURL'],
      required: false,
    }),
    databaseSchema: flags.string({
      char: 's',
      dependsOn: [],
      description: 'Enter your database schema.',
      exclusive: [],
      required: false,
    }),
    databaseSSL: flags.boolean({
      default: false,
      dependsOn: [],
      description: 'Use SSL for database connection.',
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

  static override args = [
    {
      name: 'applicationName',
      required: true,
      description: 'Name of the project to create.',
    },
  ];

  static override description = 'Generate an agent for a new project.';

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

module.exports = CreateCommand;
