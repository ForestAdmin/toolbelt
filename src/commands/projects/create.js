const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const { dbDialectOptions } = require('../../services/prompter/database-prompts');

class CreateCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const {
      assertPresent,
      authenticator,
      chalk,
      commandGenerateConfigGetter,
      database,
      databaseAnalyzer,
      dumper,
      eventSender,
      logger,
      messages,
      projectCreator,
      spinner,
    } = this.context;

    assertPresent({
      authenticator,
      chalk,
      commandGenerateConfigGetter,
      database,
      databaseAnalyzer,
      dumper,
      eventSender,
      logger,
      messages,
      projectCreator,
      spinner,
    });
    this.authenticator = authenticator;
    this.chalk = chalk;
    this.commandGenerateConfigGetter = commandGenerateConfigGetter;
    this.database = database;
    this.databaseAnalyzer = databaseAnalyzer;
    this.dumper = dumper;
    this.eventSender = eventSender;
    this.logger = logger;
    this.messages = messages;
    this.projectCreator = projectCreator;
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
    const config = await this.commandGenerateConfigGetter.get(programArguments);

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

    if (!config.databaseDialect && !config.databaseConnectionURL) {
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

    this.spinner.start({ text: 'Disconnecting from your database' });
    const disconnectPromise = this.database.disconnect(connection);
    await this.spinner.attachToPromise(disconnectPromise);

    this.spinner.start({ text: 'Creating your project on Forest Admin' });
    const projectCreationPromise = this.projectCreator.create(
      authenticationToken, appConfig,
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

  // FIXME: Not properly called/tested by testCli helper.
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

// FIXME: Currently, defaults are set on inquirer prompts, factor in config
//        and use in both?
CreateCommand.flags = {
  applicationHost: AbstractAuthenticatedCommand.flags.string({
    char: 'H',
    dependsOn: [],
    description: 'Hostname of your admin backend application.',
    exclusive: [],
    required: false,
  }),
  applicationPort: AbstractAuthenticatedCommand.flags.integer({
    char: 'P',
    dependsOn: [],
    description: 'Port of your admin backend application.',
    exclusive: [],
    required: false,
  }),
  databaseConnectionURL: AbstractAuthenticatedCommand.flags.string({
    char: 'c',
    dependsOn: [],
    description: 'Enter the database credentials with a connection URL.',
    exclusive: ['ssl'],
    required: false,
  }),
  databaseDialect: AbstractAuthenticatedCommand.flags.string({
    char: 'd',
    dependsOn: [],
    description: 'Enter your database dialect.',
    exclusive: ['databaseConnectionURL'],
    options: dbDialectOptions,
    required: false,
  }),
  databaseName: AbstractAuthenticatedCommand.flags.string({
    char: 'n',
    dependsOn: [],
    description: 'Enter your database name.',
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
  databaseHost: AbstractAuthenticatedCommand.flags.string({
    char: 'h',
    dependsOn: [],
    description: 'Enter your database host.',
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
  databasePort: AbstractAuthenticatedCommand.flags.integer({
    char: 'p',
    dependsOn: [],
    description: 'Enter your database port.',
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
  databaseUser: AbstractAuthenticatedCommand.flags.string({
    char: 'u',
    dependsOn: [],
    description: 'Enter your database user.',
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
  databasePassword: AbstractAuthenticatedCommand.flags.string({
    dependsOn: [],
    description: 'Enter your database password.',
    exclusive: ['databaseConnectionURL'],
    required: false,
  }),
  databaseSchema: AbstractAuthenticatedCommand.flags.string({
    char: 's',
    dependsOn: [],
    description: 'Enter your database schema.',
    exclusive: [],
    required: false,
  }),
  databaseSSL: AbstractAuthenticatedCommand.flags.boolean({
    default: false,
    dependsOn: [],
    description: 'Use SSL for database connection.',
    exclusive: [],
    required: false,
  }),
  mongoDBSRV: AbstractAuthenticatedCommand.flags.boolean({
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
