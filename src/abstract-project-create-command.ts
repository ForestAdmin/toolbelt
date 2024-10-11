import type { AppConfig, Config, DbConfig } from './interfaces/project-create-interface';
import type { ProjectCreateOptions } from './services/projects/create/options';
import type ProjectCreator from './services/projects/create/project-creator';
import type { ProjectMeta } from './services/projects/create/project-creator';
import type Database from './services/schema/update/database';
import type Spinner from './services/spinner';
import type EventSender from './utils/event-sender';
import type { Language } from './utils/languages';
import type Messages from './utils/messages';
import type * as OptionParser from './utils/option-parser';
import type { Config as OclifConfig } from '@oclif/core';

import { Args } from '@oclif/core';

import AbstractAuthenticatedCommand from './abstract-authenticated-command';
import { getDialect } from './services/projects/create/options';

export default abstract class AbstractProjectCreateCommand extends AbstractAuthenticatedCommand {
  private readonly eventSender: EventSender;

  private readonly optionParser: typeof OptionParser;

  private readonly projectCreator: ProjectCreator;

  protected readonly database: Database;

  protected readonly messages: typeof Messages;

  protected readonly spinner: Spinner;

  protected abstract readonly agent: string | null;

  static override args = {
    applicationName: Args.string({
      name: 'applicationName',
      required: true,
      description: 'Name of the project to create.',
    }),
  };

  /** @see https://oclif.io/docs/commands */
  static override description = 'Create a new Forest Admin project.';

  constructor(argv: string[], config: OclifConfig, plan) {
    super(argv, config, plan);

    const {
      assertPresent,
      authenticator,
      eventSender,
      optionParser,
      projectCreator,
      database,
      messages,
      spinner,
    } = this.context;

    assertPresent({
      authenticator,
      eventSender,
      optionParser,
      projectCreator,
      database,
      messages,
      spinner,
    });

    this.eventSender = eventSender;
    this.optionParser = optionParser;
    this.projectCreator = projectCreator;
    this.database = database;
    this.messages = messages;
    this.spinner = spinner;
  }

  protected async runAuthenticated(): Promise<void> {
    try {
      const { appConfig, dbConfig, language, meta, authenticationToken } = await this.getConfig();

      this.spinner.start({ text: 'Creating your project on Forest Admin' });
      const projectCreationPromise = this.projectCreator.create(
        authenticationToken,
        appConfig,
        meta,
      );
      const { id, envSecret, authSecret } = await this.spinner.attachToPromise(
        projectCreationPromise,
      );

      this.eventSender.meta.projectId = id;

      await this.testDatabaseConnection(dbConfig);

      await this.generateProject({
        dbConfig,
        appConfig,
        forestAuthSecret: authSecret as string,
        forestEnvSecret: envSecret as string,
        language,
      });

      await this.notifySuccess();
    } catch (error) {
      // Display customized error for non-authentication errors.
      if (error.status !== 401 && error.status !== 403) {
        this.logger.error(['Cannot generate your project.', `${this.messages.ERROR_UNEXPECTED}`]);
        this.logger.log(`${this.chalk.red(error)}`);
        this.exit(1);
      } else {
        throw error;
      }
    }
  }

  protected abstract generateProject(config: Config): Promise<void>;

  protected async getConfig(): Promise<{
    appConfig: AppConfig;
    dbConfig: DbConfig;
    language: Language | null;
    meta: ProjectMeta;
    authenticationToken: string;
  }> {
    const config = await this.getCommandOptions();

    // FIXME: Works as only one instance at execution time. Not ideal.
    this.eventSender.command = 'projects:create';
    this.eventSender.applicationName = config.applicationName;

    if (!config.databaseDialect && !config.databaseConnectionURL) {
      this.logger.error('Missing database dialect option value');
      this.exit(1);
    }

    const appConfig = {
      appName: config.applicationName,
      appHostname: config.applicationHost,
      appPort: Number(config.applicationPort),
    } as AppConfig;
    const dbConfig = {
      dbConnectionUrl: config.databaseConnectionURL,
      dbDialect: config.databaseDialect,
      dbSchema: config.databaseSchema,
      dbName: config.databaseName,
      dbHostname: config.databaseHost,
      dbPort: config.databasePort,
      dbSsl: config.databaseSSL,
      dbSslMode: config.databaseSslMode,
      dbUser: config.databaseUser,
      dbPassword: config.databasePassword,
      mongodbSrv: config.mongoDBSRV,
    } as DbConfig;

    const meta: ProjectMeta = {
      // FIXME: Remove the condition when the agent v1 command is dropped
      agent:
        this.agent || (dbConfig.dbDialect === 'mongodb' ? 'express-mongoose' : 'express-sequelize'),
      dbDialect: dbConfig.dbDialect,
      architecture: 'microservice',
      isLocal: ['localhost', '127.0.0.1', '::1'].some(keyword =>
        dbConfig.dbHostname
          ? dbConfig.dbHostname.includes(keyword)
          : dbConfig.dbConnectionUrl?.includes(keyword),
      ),
    };

    // This `await` seems to be useless but removing it breaks the tests.
    // Leaving it here for now until we figure out why the mocks are not compatible with the implementation.
    const authenticationToken = (await this.authenticator.getAuthToken()) || '';

    this.eventSender.sessionToken = authenticationToken;
    this.eventSender.meta = meta;

    return {
      appConfig,
      dbConfig,
      language: config.language,
      meta,
      authenticationToken,
    };
  }

  protected async getCommandOptions(): Promise<ProjectCreateOptions> {
    const options = await this.optionParser.getCommandLineOptions<ProjectCreateOptions>(this);

    // Dialect must be set for the project creator to work even if the connection URL is provided
    options.databaseDialect = getDialect(options);

    // Support both `databaseSSL` and `databaseSslMode` options
    if (options.databaseSSL !== undefined && options.databaseSslMode === undefined) {
      options.databaseSslMode = options.databaseSSL ? 'preferred' : 'disabled';
    } else if (options.databaseSSL === undefined && options.databaseSslMode !== undefined) {
      options.databaseSSL = options.databaseSslMode !== 'disabled';
    } else {
      options.databaseSslMode = 'preferred'; // Default is preferred for agent-nodejs
      options.databaseSSL = false; // Default is false for forest-express
    }

    return options;
  }

  protected async testDatabaseConnection(dbConfig: DbConfig) {
    this.spinner.start({ text: 'Testing connection to your database' });
    const connectionPromise = this.database
      .connect(dbConfig)
      .then(connection => this.database.disconnect(connection));
    await this.spinner.attachToPromise(connectionPromise);
  }

  private async notifySuccess(): Promise<void> {
    this.logger.info(`Hooray, ${this.chalk.green('installation success')}!`);
    await this.eventSender.notifySuccess();
  }
}
