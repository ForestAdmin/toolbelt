/* eslint-disable max-classes-per-file */
import type { CreateCommandArguments } from '../src/interfaces/command-create-project-arguments-interface';
import type CommandGenerateConfigGetter from '../src/services/projects/create/command-generate-config-getter';
import type * as ConfigType from '@oclif/config';

import { flags } from '@oclif/command';
import { Config } from '@oclif/config';

import AbstractProjectCreateCommand from '../src/abstract-project-create-command';
import {
  nosqlDbDialectOptions,
  sqlDbDialectOptions,
} from '../src/services/prompter/database-prompts';
import Agents from '../src/utils/agents';
import languages from '../src/utils/languages';

describe('abstractProjectCreateCommand command', () => {
  const makePlanAndStubs = () => {
    const stubs = {
      authenticator: {
        getAuthToken: jest.fn().mockResolvedValue('authToken'),
        logout: jest.fn().mockResolvedValue(true),
        tryLogin: jest.fn().mockResolvedValue(true),
      },
      chalk: {
        green: jest.fn(msg => msg),
        red: jest.fn(msg => msg),
      },
      logger: {
        error: jest.fn(),
        info: jest.fn(),
        log: jest.fn(),
      },
      eventSender: {
        notifySuccess: jest.fn(),
        meta: {},
        command: null,
        applicationName: null,
        sessionToken: null,
      },
      commandGenerateConfigGetter: {
        get: jest.fn(),
      },
      projectCreator: {
        create: jest.fn(),
      },
      database: {
        connect: jest.fn().mockResolvedValue('this is a connection'),
        disconnect: jest.fn(),
      },
      messages: {
        ERROR_UNEXPECTED:
          'An unexpected error occurred. Please reach out for help in our Developers community (https://community.forestadmin.com/) or create a Github issue with following error:',
      },
      spinner: {
        start: jest.fn(),
        attachToPromise: jest.fn(),
      },
    };
    const commandPlan = plan =>
      plan
        .addModule('chalk', stubs.chalk)
        .addInstance('logger', stubs.logger)
        .addInstance('authenticator', stubs.authenticator)
        .addInstance('eventSender', stubs.eventSender)
        .addInstance('commandGenerateConfigGetter', stubs.commandGenerateConfigGetter)
        .addInstance('projectCreator', stubs.projectCreator)
        .addInstance('database', stubs.database)
        .addInstance('messages', stubs.messages)
        .addInstance('spinner', stubs.spinner);
    return {
      commandPlan,
      stubs,
    };
  };

  describe('run', () => {
    class TestAbstractClass extends AbstractProjectCreateCommand {
      public agent: string | null = null;

      private readonly commandGenerateConfigGetter: CommandGenerateConfigGetter;

      static override readonly flags = {
        ...AbstractProjectCreateCommand.flags,
        databaseDialect: flags.string({
          char: 'd',
          dependsOn: [],
          description: 'Enter your database dialect.',
          exclusive: ['databaseConnectionURL'],
          options: [...sqlDbDialectOptions, ...nosqlDbDialectOptions].map(option => option.value),
          required: false,
        }),
        databaseSchema: flags.string({
          char: 's',
          dependsOn: [],
          description: 'Enter your database schema.',
          exclusive: [],
          required: false,
        }),
        mongoDBSRV: flags.boolean({
          dependsOn: [],
          description: 'Use SRV DNS record for mongoDB connection.',
          exclusive: ['databaseConnectionURL'],
          required: false,
        }),
        javascript: flags.boolean({
          description: 'Generate your project in javascript.',
          exclusive: ['typescript'],
          default: context => !context.flags.typescript,
        }),
        typescript: flags.boolean({
          description: 'Generate your project in typescript.',
          exclusive: ['javascript'],
          default: false,
        }),
      };

      static override readonly args = [...AbstractProjectCreateCommand.args];

      constructor(argv: string[], config: ConfigType.IConfig, plan?) {
        super(argv, config, plan);

        const { commandGenerateConfigGetter } = this.context;

        this.commandGenerateConfigGetter = commandGenerateConfigGetter;
      }

      generateProject = jest.fn().mockResolvedValue(null);

      run() {
        return this.runAuthenticated();
      }

      protected async getConfigFromArguments(programArguments: { [name: string]: any }): Promise<{
        config: CreateCommandArguments;
        specificDatabaseConfig: { [name: string]: any };
      }> {
        const config = await this.commandGenerateConfigGetter.get(programArguments, true, true);

        const specificDatabaseConfig = {
          mongodbSrv: config.mongoDBSRV,
        };

        return { config, specificDatabaseConfig };
      }
    }

    let testAbstractClass: TestAbstractClass;

    function setup(config = {}, commandArgs?) {
      const planAndStubs = makePlanAndStubs();
      planAndStubs.stubs.commandGenerateConfigGetter.get.mockReturnValue({
        applicationName: 'testApp',
        databaseConnectionURL: 'postgres://testUser:testPwd@localhost:5432/testDb',
        applicationHost: 'localhost',
        applicationPort: 3000,
        databaseSchema: 'public',
        databaseSSL: false,
        databaseDialect: 'postgres',
        language: languages.Javascript,
        ...config,
      });

      planAndStubs.stubs.spinner.attachToPromise.mockResolvedValue({
        id: 1,
        envSecret: 'this an envSecret',
        authSecret: 'this is an authSecret',
      });

      testAbstractClass = new TestAbstractClass(
        commandArgs || [
          'testApp',
          '--databaseConnectionURL',
          'postgres://testUser:testPwd@localhost:5432/testDb',
          '--applicationHost',
          'localhost',
          '--applicationPort',
          '3300',
          '--databaseSchema',
          'public',
        ],
        new Config({ root: process.cwd() }),
        planAndStubs.commandPlan,
      );

      return { stubs: planAndStubs.stubs, instance: testAbstractClass };
    }

    it('should create a project and log progress', async () => {
      expect.assertions(4);

      const { stubs, instance } = setup();

      await instance.run();

      expect(stubs.spinner.start).toHaveBeenCalledTimes(2);
      expect(stubs.spinner.start).toHaveBeenNthCalledWith(1, {
        text: 'Creating your project on Forest Admin',
      });
      expect(stubs.projectCreator.create).toHaveBeenCalledTimes(1);
      expect(stubs.projectCreator.create).toHaveBeenCalledWith(
        'authToken',
        {
          appName: 'testApp',
          appHostname: 'localhost',
          appPort: 3000,
        },
        {
          dbDialect: 'postgres',
          agent: Agents.ExpressSequelize,
          isLocal: true,
          architecture: 'microservice',
          projectId: 1,
        },
      );
    });

    it('should throw an error when there is a 401 error', async () => {
      expect.assertions(1);

      const { stubs, instance } = setup();

      const error = {
        status: 401,
      };

      stubs.spinner.attachToPromise.mockRejectedValue(error);

      await expect(instance.run()).rejects.toBe(error);
    });

    it('should throw an error when there is a 403 error', async () => {
      expect.assertions(1);

      const { stubs, instance } = setup();

      const error = {
        status: 403,
      };

      stubs.spinner.attachToPromise.mockRejectedValue(error);

      await expect(instance.run()).rejects.toBe(error);
    });

    it('should exit with code 1 when the error is not a 401 or a 403', async () => {
      expect.assertions(1);

      const { stubs, instance } = setup();

      const error = {
        status: 400,
      };

      stubs.spinner.attachToPromise.mockRejectedValue(error);

      jest.spyOn(instance, 'exit').mockReturnValue(true as never);

      await instance.run();

      expect(instance.exit).toHaveBeenCalledWith(1);
    });

    it('should test that the database is connectable and disconnect', async () => {
      expect.assertions(4);

      const { stubs, instance } = setup();

      await instance.run();

      expect(stubs.spinner.start).toHaveBeenCalledWith({
        text: 'Testing connection to your database',
      });
      expect(stubs.database.connect).toHaveBeenCalledTimes(1);
      expect(stubs.database.disconnect).toHaveBeenCalledTimes(1);
      expect(stubs.database.disconnect).toHaveBeenCalledWith('this is a connection');
    });

    it('should call child generateProject', async () => {
      expect.assertions(1);

      const { instance } = setup();

      await instance.run();

      expect(instance.generateProject).toHaveBeenCalledTimes(1);
    });

    it('should log the installation success and send the event', async () => {
      expect.assertions(9);

      const { stubs, instance } = setup();

      await instance.run();

      expect(stubs.logger.info).toHaveBeenCalledTimes(1);
      expect(stubs.logger.info).toHaveBeenCalledWith('Hooray, installation success!');
      expect(stubs.chalk.green).toHaveBeenCalledTimes(1);
      expect(stubs.eventSender.meta).toStrictEqual({
        dbDialect: 'postgres',
        agent: Agents.ExpressSequelize,
        isLocal: true,
        architecture: 'microservice',
        projectId: 1,
      });
      expect(stubs.eventSender.command).toBe('projects:create');
      expect(stubs.eventSender.applicationName).toBe('testApp');
      expect(stubs.eventSender.sessionToken).toBe('authToken');
      expect(stubs.eventSender.meta).toStrictEqual({
        dbDialect: 'postgres',
        agent: Agents.ExpressSequelize,
        isLocal: true,
        architecture: 'microservice',
        projectId: 1,
      });
      expect(stubs.eventSender.notifySuccess).toHaveBeenCalledTimes(1);
    });

    describe('on a mongo database', () => {
      const config = {
        applicationName: 'testApp',
        databaseConnectionURL: 'mongodb://testUser:testPwd@localhost:5432/dbName',
        applicationHost: 'localhost',
        applicationPort: 3000,
        databaseSSL: false,
        databaseDialect: 'mongodb',
        databaseSchema: undefined,
        mongoDbSrv: false,
        ssl: false,
      };
      const commandArgs = [
        'testApp',
        '--databaseConnectionURL',
        'mongodb://testUser:testPwd@localhost:5432/dbName',
        '--applicationHost',
        'localhost',
        '--applicationPort',
        '3300',
      ];

      it('should test that the database is reachable', async () => {
        expect.assertions(1);

        const { instance, stubs } = setup(config, commandArgs);

        await instance.run();

        expect(stubs.database.connect).toHaveBeenCalledWith({
          dbConnectionUrl: 'mongodb://testUser:testPwd@localhost:5432/dbName',
          dbDialect: 'mongodb',
          dbHostname: undefined,
          dbName: undefined,
          dbPassword: undefined,
          dbPort: undefined,
          dbSchema: undefined,
          dbUser: undefined,
          mongodbSrv: undefined,
          dbSsl: false,
        });
      });

      it('should call generate project with correct arguments', async () => {
        expect.assertions(4);

        const { instance, stubs } = setup(config, commandArgs);

        await instance.run();

        expect(stubs.eventSender.command).toBe('projects:create');
        expect(stubs.eventSender.applicationName).toBe('testApp');
        expect(stubs.eventSender.sessionToken).toBe('authToken');
        expect(stubs.eventSender.meta).toStrictEqual({
          dbDialect: 'mongodb',
          agent: Agents.ExpressMongoose,
          isLocal: true,
          architecture: 'microservice',
          projectId: 1,
        });
      });

      it('call generateProject with the correct properties', async () => {
        expect.assertions(1);

        const { instance } = setup(config, commandArgs);

        await instance.run();

        expect(instance.generateProject).toHaveBeenCalledWith({
          appConfig: {
            appName: 'testApp',
            appHostname: 'localhost',
            appPort: 3000,
          },
          dbConfig: {
            dbConnectionUrl: 'mongodb://testUser:testPwd@localhost:5432/dbName',
            dbDialect: 'mongodb',
            dbHostname: undefined,
            dbName: undefined,
            dbPassword: undefined,
            dbPort: undefined,
            dbSchema: undefined,
            dbUser: undefined,
            mongodbSrv: undefined,
            dbSsl: false,
          },
          forestAuthSecret: 'this is an authSecret',
          forestEnvSecret: 'this an envSecret',
          language: languages.Javascript,
        });
      });
    });
    describe('on a sql database', () => {
      it('should test that the database is reachable', async () => {
        expect.assertions(1);

        const { instance, stubs } = setup();

        await instance.run();

        expect(stubs.database.connect).toHaveBeenCalledWith({
          dbConnectionUrl: 'postgres://testUser:testPwd@localhost:5432/testDb',
          dbDialect: 'postgres',
          dbHostname: undefined,
          dbName: undefined,
          dbPassword: undefined,
          dbPort: undefined,
          dbSchema: 'public',
          dbUser: undefined,
          mongodbSrv: undefined,
          dbSsl: false,
        });
      });
      it('should call generate project with correct arguments', async () => {
        expect.assertions(4);

        const { instance, stubs } = setup();

        await instance.run();

        expect(stubs.eventSender.command).toBe('projects:create');
        expect(stubs.eventSender.applicationName).toBe('testApp');
        expect(stubs.eventSender.sessionToken).toBe('authToken');
        expect(stubs.eventSender.meta).toStrictEqual({
          dbDialect: 'postgres',
          agent: Agents.ExpressSequelize,
          isLocal: true,
          architecture: 'microservice',
          projectId: 1,
        });
      });

      it('call generateProject with the correct properties', async () => {
        expect.assertions(1);

        const { instance } = setup();

        await instance.run();

        expect(instance.generateProject).toHaveBeenCalledWith({
          appConfig: {
            appName: 'testApp',
            appHostname: 'localhost',
            appPort: 3000,
          },
          dbConfig: {
            dbConnectionUrl: 'postgres://testUser:testPwd@localhost:5432/testDb',
            dbDialect: 'postgres',
            dbHostname: undefined,
            dbName: undefined,
            dbPassword: undefined,
            dbPort: undefined,
            dbSchema: 'public',
            dbUser: undefined,
            mongodbSrv: undefined,
            dbSsl: false,
          },
          forestAuthSecret: 'this is an authSecret',
          forestEnvSecret: 'this an envSecret',
          language: languages.Javascript,
        });
      });
    });
  });
});
