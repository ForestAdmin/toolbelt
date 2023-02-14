import { flags } from '@oclif/command';
import { Config } from '@oclif/config';
import AbstractAuthenticatedCommand from './abstract-authenticated-command';
import EventSender from './utils/event-sender';
import CommandGenerateConfigGetter from './services/projects/create/command-generate-config-getter';
import ProjectCreator, { ProjectMeta } from './services/projects/create/project-creator';
import Spinner from './services/spinner';
import Database from './services/schema/update/database';
import Messages from './utils/messages';
import { dbDialectOptions } from './services/prompter/database-prompts';

export interface DbConfigInterface {
  dbConnectionUrl?: string;
  dbDialect?: string;
  dbHostname?: string;
  dbName?: string;
  dbPassword?: string;
  dbPort?: number;
  dbSchema?: string;
  dbUser?: string;
  mongodbSrv?: boolean;
  ssl: boolean;
}

export interface AppConfig {
  applicationName: string;
  appHostname: string;
  appPort: number;
}

export interface ConfigInterface {
  dbConfig: DbConfigInterface;
  appConfig: AppConfig;
  forestAuthSecret: string;
  forestEnvSecret: string;
}

export default abstract class AbstractProjectCreateCommand extends AbstractAuthenticatedCommand {
  private eventSender: EventSender;

  private commandGenerateConfigGetter: CommandGenerateConfigGetter;

  private projectCreator: ProjectCreator;

  protected database: Database;

  private messages: typeof Messages;

  protected spinner: Spinner;

  constructor(argv: string[], config: Config, plan) {
    super(argv, config, plan);

    const {
      assertPresent,
      authenticator,
      eventSender,
      commandGenerateConfigGetter,
      projectCreator,
      database,
      messages,
      spinner,
    } = this.context;

    assertPresent({
      authenticator,
      eventSender,
      commandGenerateConfigGetter,
      projectCreator,
      database,
      messages,
      spinner,
    });

    this.eventSender = eventSender;
    this.commandGenerateConfigGetter = commandGenerateConfigGetter;
    this.projectCreator = projectCreator;
    this.database = database;
    this.messages = messages;
    this.spinner = spinner;
  }

  // FIXME: Not properly called/tested by testCli helper.
  // Error handler for the command. If the error is not handled elsewhere, it will be caught here.
  override async catch(error) {
    // Call authentication error handler.
    await this.handleAuthenticationErrors(error);

    this.logger.error(
      `Cannot generate your project. ${this.messages.ERROR_UNEXPECTED} ${this.chalk.red(error)}`,
    );

    this.exit(1);
  }

  static makeArgsAndFlagsAndDescription() {
    return {
      args: [
        {
          name: 'applicationName',
          required: true,
          description: 'Name of the project to create.',
        },
      ],
      flags: {
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
      },
      description: 'Create a new Forest Admin project.',
    };
  }

  async getConfig(commandClass): Promise<{
    appConfig: AppConfig;
    dbConfig: DbConfigInterface;
    meta: ProjectMeta;
    authenticationToken: string;
  }> {
    const { args: parsedArgs, flags: parsedFlags } = this.parse(commandClass);

    // FIXME: Works as only one instance at execution time. Not ideal.
    this.eventSender.command = 'projects:create';
    this.eventSender.applicationName = parsedArgs.applicationName;

    const programArguments = { ...parsedArgs, ...(parsedFlags as unknown as object) };
    const config = await this.commandGenerateConfigGetter.get(programArguments);

    const appConfig = {
      applicationName: config.applicationName,
      appHostname: config.applicationHost,
      appPort: config.applicationPort,
    };
    const dbConfig: DbConfigInterface = {
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

    const meta: ProjectMeta = {
      dbDialect: dbConfig.dbDialect,
      agent: dbConfig.dbDialect === 'mongodb' ? 'express-mongoose' : 'express-sequelize',
      isLocal: ['localhost', '127.0.0.1', '::1'].some(keyword =>
        dbConfig.dbHostname
          ? dbConfig.dbHostname.includes(keyword)
          : dbConfig.dbConnectionUrl.includes(keyword),
      ),
      architecture: 'microservice',
    };

    const authenticationToken = (await this.authenticator.getAuthToken()) || '';

    this.eventSender.sessionToken = authenticationToken;
    this.eventSender.meta = meta;

    return { appConfig, dbConfig, meta, authenticationToken };
  }

  async createProject(commandClass) {
    const { appConfig, dbConfig, meta, authenticationToken } = await this.getConfig(commandClass);

    this.spinner.start({ text: 'Creating your project on Forest Admin' });
    const projectCreationPromise = this.projectCreator.create(authenticationToken, appConfig, meta);
    const { id, envSecret, authSecret } = await this.spinner.attachToPromise(
      projectCreationPromise,
    );

    this.eventSender.meta.projectId = id;

    await this.testDatabaseConnection(dbConfig);

    return {
      dbConfig,
      appConfig,
      forestAuthSecret: authSecret as string,
      forestEnvSecret: envSecret as string,
    };
  }

  async testDatabaseConnection(dbConfig: DbConfigInterface) {
    this.spinner.start({ text: 'Testing connection to your database' });
    const connectionPromise = this.database
      .connect(dbConfig)
      .then(connection => this.database.disconnect(connection));
    await this.spinner.attachToPromise(connectionPromise);
  }

  async notifySuccess() {
    this.logger.info(`Hooray, ${this.chalk.green('installation success')}!`);
    await this.eventSender.notifySuccess();
  }

  abstract createFiles(config: ConfigInterface, schema?): Promise<void>;
}
