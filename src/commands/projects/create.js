const { flags } = require('@oclif/command');

const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const { dbDialectOptions } = require('../../services/prompter/database-prompts');

const makeDefaultPlan = require('../../context/init');

class CreateCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const {
      api,
      assertPresent,
      authenticator,
      chalk,
      CommandGenerateConfigGetter,
      database,
      databaseAnalyzer,
      dumper,
      eventSender,
      logger,
      messages,
      ProjectCreator,
      spinner,
    } = this.context;

    assertPresent({
      api,
      authenticator,
      chalk,
      CommandGenerateConfigGetter,
      database,
      databaseAnalyzer,
      dumper,
      eventSender,
      logger,
      messages,
      ProjectCreator,
      spinner,
    });
    this.api = api;
    this.authenticator = authenticator;
    this.chalk = chalk;
    this.CommandGenerateConfigGetter = CommandGenerateConfigGetter;
    this.database = database;
    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = dumper;
    this.eventSender = eventSender;
    this.logger = logger;
    this.messages = messages;
    this.ProjectCreator = ProjectCreator;
    this.spinner = spinner;
  }

  async runIfAuthenticated() {
    const { args: parsedArgs, flags: parsedFlags } = this.parse(CreateCommand);
    const authenticationToken = this.authenticator.getAuthToken();

    this.args = parsedArgs;
    this.flags = parsedFlags;

    // FIXME: Works as only one instance at execution time. Not ideal.
    this.eventSender.command = 'projects:create';
    this.eventSender.applicationName = this.args.applicationName;

    const programArguments = { ...this.args, ...this.flags };
    const config = await this.CommandGenerateConfigGetter.get(programArguments);

    const appConfig = {
      applicationName: config.applicationName,
      appHostname: config.applicationHost,
      appPort: config.applicationPort,
    };
    const dbConfig = {
      dbConnectionUrl: config.databaseConnectionURL,
      dbDialect: config.databaseDialect,
      dbHostname: config.databaseHost,
      dbPort: config.databasePort,
      dbName: config.databaseName,
      dbUser: config.databaseUser,
      dbPassword: config.databasePassword,
      ssl: config.databaseSSL,
      mongodbSrv: config.mongoDBSRV,
    };

    if (!config.databaseDialect && !!config.databaseConnectionURL) {
      this.logger.error('Missing database dialect option value');
      this.exit(1);
    }

    let schema = {};

    this.spinner.start({ text: 'Connecting to your database' });
    const connectionPromise = this.database.connect(dbConfig);
    const connection = await this.spinner.attachToPromise(connectionPromise);

    this.spinner.start({ text: 'Analyzing the database' });
    const schemaPromise = this.databaseAnalyzer.analyze(connection, dbConfig, true);
    schema = await this.spinner.attachToPromise(schemaPromise);

    await this.database.disconnect(connection);

    this.spinner.start({ text: 'Creating your project on Forest Admin' });
    const projectCreationPromise = this.ProjectCreator.create(
      authenticationToken, this.api, config.applicationName, appConfig,
    );

    const { envSecret, authSecret } = await this.spinner.attachToPromise(projectCreationPromise);
    config.forestAuthSecret = authSecret;
    config.forestEnvSecret = envSecret;

    this.spinner.start({ text: 'Creating your project files' });
    const dumperConfig = {
      ...dbConfig,
      ...appConfig,
      forestAuthSecret: config.forestAuthSecret,
      forestEnvSecret: config.forestEnvSecret,
    };
    const dumpPromise = this.dumper.dump(schema, dumperConfig);
    await this.spinner.attachToPromise(dumpPromise);

    this.logger.success(`Hooray, ${this.chalk.green('installation success')}!`);
    await this.eventSender.notifySuccess();
  }

  async catch(error) {
    this.logger.error([
      'Cannot generate your project.',
      `${this.messages.ERROR_UNEXPECTED}`,
    ]);
    this.logger.log(`${this.chalk.red(error)}`);
    this.exit(1);
  }
}

CreateCommand.description = 'Create a Forest API.';

CreateCommand.flags = {
  applicationHost: flags.string({
    char: 'H',
    dependsOn: [],
    description: 'Hostname of your admin backend application.',
    exclusive: ['application-port'],
    required: false,
  }),
  applicationPort: flags.string({
    char: 'P',
    dependsOn: [],
    description: 'Port of your admin backend application.',
    exclusive: ['application-host'],
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
    options: dbDialectOptions,
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
  databasePort: flags.string({
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
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
  databaseSSL: flags.boolean({
    dependsOn: [],
    description: 'Use SSL for database connection.',
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
  mongoDBSRV: flags.boolean({
    dependsOn: [],
    description: 'Use SRV DNS record for mongoDB connection.',
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
};

CreateCommand.args = [
  {
    name: 'applicationName',
    required: true,
    description: 'Name of the project to create.',
  },
];

module.exports = CreateCommand;
