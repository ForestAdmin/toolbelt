const { flags } = require('@oclif/command');
const { inject } = require('@forestadmin/context');

const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class CreateCommand extends AbstractAuthenticatedCommand {
  constructor(...args) {
    super(...args);

    const {
      api,
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
      spinners,
      terminator,
    } = inject();
    if (!api) throw new Error('Missing dependency api');
    if (!authenticator) throw new Error('Missing dependency authenticator');
    if (!chalk) throw new Error('Missing dependency chalk');
    if (!commandGenerateConfigGetter) throw new Error('Missing dependency commandGenerateConfigGetter');
    if (!database) throw new Error('Missing dependency database');
    if (!databaseAnalyzer) throw new Error('Missing dependency databaseAnalyzer');
    if (!dumper) throw new Error('Missing dependency dumper');
    if (!eventSender) throw new Error('Missing dependency eventSender');
    if (!logger) throw new Error('Missing dependency logger');
    if (!messages) throw new Error('Missing dependency messages');
    if (!projectCreator) throw new Error('Missing dependency this.projectCreator');
    if (!spinners) throw new Error('Missing dependency spinners');
    if (!terminator) throw new Error('Missing dependency this.terminator');
    this.api = api;
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
    this.spinners = spinners;
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

    const config = await this.commandGenerateConfigGetter.get(this.config);

    let schema = {};

    const connectionPromise = this.database.connect(config);
    this.spinners.add('database-connection', { text: 'Connecting to your database' }, connectionPromise);
    const connection = await connectionPromise;

    const schemaPromise = this.databaseAnalyzer.perform(connection, config, true);
    this.spinners.add('database-analysis', { text: 'Analyzing the database' }, schemaPromise);
    schema = await schemaPromise;

    const projectCreationPromise = this.projectCreator.create(
      authenticationToken, this.api, config.appName, config,
    );
    this.spinners.add('project-creation', { text: 'Creating your project on Forest Admin' }, projectCreationPromise);

    const { envSecret, authSecret } = await projectCreationPromise;
    config.forestEnvSecret = envSecret;
    config.forestAuthSecret = authSecret;

    const spinner = this.spinners.add('dumper', { text: 'Creating your project files' });
    this.logger.spinner = spinner;
    await this.dumper.dump(schema, config);
    spinner.succeed();

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
