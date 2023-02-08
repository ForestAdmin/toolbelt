const { flags } = require('@oclif/command');
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
      dbName: config.databaseName,
      dbPassword: config.databasePassword,
      dbPort: config.databasePort,
      dbSchema: config.databaseSchema,
      dbUser: config.databaseUser,
      mongodbSrv: config.mongoDBSRV,
      ssl: config.databaseSSL,
    };

    if (!config.databaseDialect && !config.databaseConnectionURL) {
      this.logger.error('Missing database dialect option value');
      this.exit(1);
    }

    /** @type {import('../../services/projects/create/project-creator').ProjectMeta} */
    const meta = {
      dbDialect: dbConfig.dbDialect,
      agent: dbConfig.dbDialect === 'mongodb' ? 'express-mongoose' : 'express-sequelize',
      isLocal: ['localhost', '127.0.0.1', '::1'].some(keyword =>
        dbConfig.dbHostname
          ? dbConfig.dbHostname.includes(keyword)
          : dbConfig.dbConnectionUrl.includes(keyword),
      ),
      architecture: 'microservice',
    };

    this.eventSender.sessionToken = authenticationToken;
    this.eventSender.meta = meta;

    this.spinner.start({ text: 'Creating your project on Forest Admin' });
    const projectCreationPromise = this.projectCreator.create(authenticationToken, appConfig, meta);

    const { id, envSecret, authSecret } = await this.spinner.attachToPromise(
      projectCreationPromise,
    );

    this.eventSender.meta.projectId = id;
    config.forestAuthSecret = authSecret;
    config.forestEnvSecret = envSecret;

    let schema = {};

    this.spinner.start({ text: 'Connecting to your database' });
    const connectionPromise = this.database.connect(dbConfig);
    const connection = await this.spinner.attachToPromise(connectionPromise);

    schema = await this.analyzeDatabase(dbConfig, connection);

    this.spinner.start({ text: 'Disconnecting from your database' });
    const disconnectPromise = this.database.disconnect(connection);
    await this.spinner.attachToPromise(disconnectPromise);

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

  async analyzeDatabase(dbConfig, connection) {
    if (dbConfig.dbDialect === 'mongodb') {
      // the mongodb analyzer display a progress bar during the analysis
      this.logger.info('Analyzing the database...');
      const analysis = await this.databaseAnalyzer.analyzeMongoDb(connection, dbConfig, true);
      this.logger.success('Database is analyzed', { lineColor: 'green' });
      return analysis;
    }

    this.spinner.start({ text: 'Analyzing the database' });
    const schemaPromise = this.databaseAnalyzer.analyze(connection, dbConfig, true);
    return this.spinner.attachToPromise(schemaPromise);
  }

  // FIXME: Not properly called/tested by testCli helper.
  async catch(error) {
    this.logger.error(['Cannot generate your project.', `${this.messages.ERROR_UNEXPECTED}`]);
    this.logger.log(`${this.chalk.red(error)}`);
    this.exit(1);
  }
}

CreateCommand.description = 'Create a Forest API.';

// FIXME: Currently, defaults are set on inquirer prompts, factor in config
//        and use in both?
CreateCommand.flags = {
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

CreateCommand.args = [
  {
    name: 'applicationName',
    required: true,
    description: 'Name of the project to create.',
  },
];

module.exports = CreateCommand;
