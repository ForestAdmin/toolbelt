const { flags } = require('@oclif/command');

const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
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
      terminator,
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
      terminator,
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
    this.terminator = terminator;
  }

  async runIfAuthenticated() {
    const { args: parsedArgs, flags: parsedFlags } = this.parse(CreateCommand);
    const authenticationToken = this.authenticator.getAuthToken();

    this.args = parsedArgs;
    this.flags = parsedFlags;
    this.config = { ...this.args, ...this.flags };

    this.eventSender.command = 'projects:create';
    this.eventSender.appName = this.args.appName;

    const config = await this.CommandGenerateConfigGetter.get(this.config);

    let schema = {};

    this.spinner.start({ text: 'Connecting to your database' });
    const connectionPromise = this.database.connect(config);
    this.spinner.attachToPromise(connectionPromise);

    const connection = await connectionPromise;

    this.spinner.start({ text: 'Analyzing the database' });
    const schemaPromise = this.databaseAnalyzer.analyze(connection, config, true);
    this.spinner.attachToPromise(schemaPromise);

    schema = await schemaPromise;

    this.spinner.start({ text: 'Creating your project on Forest Admin' });
    const projectCreationPromise = this.ProjectCreator.create(
      authenticationToken, this.api, config.appName, config,
    );
    this.spinner.attachToPromise(projectCreationPromise);

    const { envSecret, authSecret } = await projectCreationPromise;
    config.forestEnvSecret = envSecret;
    config.forestAuthSecret = authSecret;

    this.spinner.start({ text: 'Creating your project files' });
    const dumpPromise = this.dumper.dump(schema, config);
    this.spinner.attachToPromise(dumpPromise);
    await dumpPromise;

    this.logger.success(`Hooray, ${this.chalk.green('installation success')}!`);
    await this.eventSender.notifySuccess();
    process.exit(0);
  }

  async catch(error) {
    const logs = [
      'Cannot generate your project.',
      `${this.messages.ERROR_UNEXPECTED} ${this.chalk.red(error)}`,
    ];

    await this.terminator.terminate(1, {
      logs,
    });
  }
}

CreateCommand.description = 'Create a Forest API.';

CreateCommand.flags = {
  'application-host': flags.string({
    char: 'H',
    dependsOn: [],
    description: 'Hostname of your admin backend application.',
    exclusive: ['application-port'],
    required: false,
  }),
  'application-port': flags.string({
    char: 'p',
    dependsOn: [],
    description: 'Port of your admin backend application.',
    exclusive: ['application-host'],
    required: false,
  }),
  'connection-url': flags.string({
    char: 'c',
    dependsOn: [],
    description: 'Enter the database credentials with a connection URL.',
    exclusive: ['ssl'],
    required: false,
  }),
  email: flags.string({
    char: 'e',
    dependsOn: [],
    description: 'Your Forest Admin account email.',
    exclusive: [],
    required: false,
  }),
  password: flags.string({
    char: 'P',
    dependsOn: ['email'],
    description: 'Your Forest Admin account password.',
    exclusive: ['token'],
    required: false,
  }),
  schema: flags.string({
    char: 's',
    dependsOn: [],
    description: 'Enter your database schema.',
    exclusive: [],
    required: false,
  }),
  ssl: flags.boolean({
    char: 'S',
    default: false,
    dependsOn: [],
    description: 'Use SSL for database connection.',
    exclusive: ['connection-url'],
    required: true,
  }),
  token: flags.string({
    char: 't',
    dependsOn: ['email'],
    description: 'Your Forest Admin account token.',
    exclusive: ['password'],
    required: false,
  }),
};

CreateCommand.args = [
  {
    name: 'appName',
    required: true,
    description: 'Name of the project to create.',
  },
];

module.exports = CreateCommand;
