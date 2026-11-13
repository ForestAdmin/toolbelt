/* eslint-disable max-classes-per-file */

import { Config, Flags } from '@oclif/core';

import AbstractProjectCreateCommand from '../src/abstract-project-create-command';
import DemoCommand from '../src/commands/projects/create/demo';
import InAppCommand from '../src/commands/projects/create/in-app';
import NosqlCommand from '../src/commands/projects/create/nosql';
import SqlCommand from '../src/commands/projects/create/sql';
import InvalidOptionError from '../src/errors/options/invalid-option-error';
import { validateSqlConnectionUrl } from '../src/services/projects/create/options';
import Agents from '../src/utils/agents';
import languages, { languageList } from '../src/utils/languages';

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
        warn: jest.fn(),
      },
      eventSender: {
        notifySuccess: jest.fn(),
        meta: {},
        command: null,
        applicationName: null,
        sessionToken: null,
      },
      optionParser: {
        getCommandLineOptions: jest.fn(),
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
          'An unexpected error occurred. Please contact our support (https://forest.app/forms/support) or create a Github issue with following error:',
      },
      databaseAnalyzer: {
        analyzeMongoDb: jest.fn(),
        analyze: jest.fn(),
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
        .addInstance('optionParser', stubs.optionParser)
        .addInstance('projectCreator', stubs.projectCreator)
        .addInstance('database', stubs.database)
        .addInstance('messages', stubs.messages)
        .addInstance('databaseAnalyzer', stubs.databaseAnalyzer)
        .addInstance('spinner', stubs.spinner);
    return {
      commandPlan,
      stubs,
    };
  };

  describe('run', () => {
    class TestAbstractClass extends AbstractProjectCreateCommand {
      public agent: string | null = null;

      protected static options = {
        databaseConnectionURL: {
          oclif: { description: 'Enter the database credentials with a connection URL.' },
          prompter: { question: 'url?', validate: validateSqlConnectionUrl },
        },
      };

      // eslint-disable-next-line class-methods-use-this
      override dump() {
        return Promise.resolve();
      }

      static override readonly flags = {
        ...AbstractProjectCreateCommand.flags,
        databaseDialect: Flags.string({
          char: 'd',
          dependsOn: [],
          description: 'Enter your database dialect.',
          exclusive: ['databaseConnectionURL'],
          options: ['mssql', 'mysql', 'postgres', 'mongodb'],
          required: false,
        }),
        databaseSchema: Flags.string({
          char: 's',
          dependsOn: [],
          description: 'Enter your database schema.',
          exclusive: [],
          required: false,
        }),
        mongoDBSRV: Flags.boolean({
          dependsOn: [],
          description: 'Use SRV DNS record for mongoDB connection.',
          exclusive: ['databaseConnectionURL'],
          required: false,
        }),
        language: Flags.string({
          char: 'l',
          description: 'Choose the language you wna tot use for your project.',
          options: languageList.map(language => language.name),
          default: 'required',
          required: false,
        }),
      };

      generateProject = jest.fn().mockResolvedValue(null);

      run() {
        return this.runAuthenticated();
      }
    }

    let testAbstractClass: TestAbstractClass;

    function setup(config = {}, commandArgs?: string[], isSupabaseUrl?: boolean) {
      const planAndStubs = makePlanAndStubs();
      planAndStubs.stubs.optionParser.getCommandLineOptions.mockReturnValue({
        applicationName: 'testApp',
        databaseConnectionURL: `postgres${
          isSupabaseUrl ? 'ql' : ''
        }://testUser:testPwd@localhost:5432/testDb`,
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

    describe('with --invitation', () => {
      const CLAIM = 'SENTINELclaimAAAAAAAAAAAAAAAAAAAA';

      class InvitedTestClass extends TestAbstractClass {
        static override readonly args = AbstractProjectCreateCommand.args;

        static override readonly flags = {
          ...TestAbstractClass.flags,
          ...AbstractProjectCreateCommand.invitationFlags,
        };

        override run() {
          return AbstractProjectCreateCommand.prototype.run.call(this);
        }
      }

      function makePlanAndStubsFrom(stubs: ReturnType<typeof makePlanAndStubs>['stubs']) {
        return plan =>
          plan
            .addModule('chalk', stubs.chalk)
            .addInstance('logger', stubs.logger)
            .addInstance('authenticator', stubs.authenticator)
            .addInstance('eventSender', stubs.eventSender)
            .addInstance('optionParser', stubs.optionParser)
            .addInstance('projectCreator', stubs.projectCreator)
            .addInstance('database', stubs.database)
            .addInstance('messages', stubs.messages)
            .addInstance('databaseAnalyzer', stubs.databaseAnalyzer)
            .addInstance('spinner', stubs.spinner);
      }

      function setupInvited(invitation: string) {
        const { stubs } = setup();
        const instance = new InvitedTestClass(
          ['testApp', '--invitation', invitation],
          new Config({ root: process.cwd() }),
          makePlanAndStubsFrom(stubs),
        );
        jest.spyOn(instance, 'exit').mockReturnValue(undefined as never);

        return { stubs, instance };
      }

      function loggedText(stubs: ReturnType<typeof makePlanAndStubs>['stubs']) {
        return [stubs.logger.error, stubs.logger.log, stubs.logger.info, stubs.logger.warn]
          .flatMap(logger => logger.mock.calls.flat())
          .map(String)
          .join('\n');
      }

      it('should pass the claim to the project creator', async () => {
        expect.assertions(1);

        const { stubs, instance } = setupInvited(CLAIM);
        await instance.run();

        expect(stubs.projectCreator.create).toHaveBeenCalledWith(
          'authToken',
          expect.anything(),
          expect.anything(),
          CLAIM,
        );
      });

      it('should print the switch-account help on a wrong account, without logging out', async () => {
        expect.assertions(4);

        const { stubs, instance } = setupInvited(CLAIM);
        stubs.spinner.attachToPromise.mockRejectedValue({
          status: 403,
          response: {
            body: { errors: [{ meta: { code: 'developer_invitation_claim_wrong_account' } }] },
          },
        });

        await instance.run();

        expect(stubs.logger.error).toHaveBeenCalledWith(expect.stringContaining('forest logout'));
        expect(instance.exit).toHaveBeenCalledWith(1);
        expect(stubs.authenticator.logout).not.toHaveBeenCalled();
        expect(loggedText(stubs)).not.toContain('You do not have the right');
      });

      it('should refuse a malformed claim before login and before any creation', async () => {
        expect.assertions(4);

        const { stubs, instance } = setupInvited('x;rm -rf ~');
        await instance.run();

        expect(stubs.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('is not a valid invitation claim'),
        );
        expect(loggedText(stubs)).not.toContain('x;rm');
        expect(stubs.authenticator.tryLogin).not.toHaveBeenCalled();
        expect(stubs.projectCreator.create).not.toHaveBeenCalled();
      });

      it('should refuse a claim also passed as the project name, before any creation', async () => {
        expect.assertions(3);

        const { stubs, instance } = setupInvited(CLAIM);
        Object.assign(instance, { argv: [CLAIM, '--invitation', CLAIM] });
        await instance.run();

        expect(stubs.logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Pass the invitation claim once'),
        );
        expect(stubs.authenticator.tryLogin).not.toHaveBeenCalled();
        expect(stubs.projectCreator.create).not.toHaveBeenCalled();
      });

      it.each([
        ['sql', SqlCommand],
        ['nosql', NosqlCommand],
        ['in-app', InAppCommand],
        ['demo', DemoCommand],
      ])('should wire a hidden --invitation flag on projects:create:%s', (_, command) => {
        expect.hasAssertions();
        expect(command.flags.invitation.hidden).toBe(true);
      });
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

    it('should print a refused option value on its own, without the unexpected-error banner', async () => {
      expect.assertions(3);

      const { stubs, instance } = setup();
      const error = new InvalidOptionError(
        'Invalid value for databaseConnectionURL: mariadb:// is not supported by the generated project, use mysql:// instead',
      );

      stubs.optionParser.getCommandLineOptions.mockImplementation(() => {
        throw error;
      });
      jest.spyOn(instance, 'exit').mockReturnValue(true as never);

      await instance.run();

      expect(stubs.logger.error).toHaveBeenCalledWith(error.message);
      expect(stubs.logger.error).not.toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('unexpected')]),
      );
      expect(instance.exit).toHaveBeenCalledWith(1);
    });

    describe('when the connection URL flag carries a scheme the prompt would refuse', () => {
      it('should warn and carry on, because the flag is not a gate', async () => {
        expect.assertions(2);

        const { stubs, instance } = setup({
          databaseConnectionURL: 'mariadb://u:p@localhost:3306/db',
          databaseDialect: undefined,
        });

        await instance.run();

        expect(stubs.logger.warn).toHaveBeenCalledWith(
          'mariadb:// is not supported by the generated project, use mysql:// instead',
        );
        expect(stubs.projectCreator.create).toHaveBeenCalledTimes(1);
      });
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

    it('should log the installation success and send the event with supabase url', async () => {
      expect.assertions(9);

      const { stubs, instance } = setup(undefined, undefined, true);

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

    describe('when the connection URL is pasted with surrounding whitespace', () => {
      it('should trim it before deriving the dialect and connecting', async () => {
        expect.assertions(2);

        const config = { databaseConnectionURL: '  postgres://u:p@localhost:5432/db\n' };
        const commandArgs = [
          'testApp',
          '--applicationHost',
          'localhost',
          '--applicationPort',
          '3300',
        ];

        const { instance, stubs } = setup(config, commandArgs);

        await instance.run();

        expect(stubs.database.connect).toHaveBeenCalledWith(
          expect.objectContaining({
            dbConnectionUrl: 'postgres://u:p@localhost:5432/db',
            dbDialect: 'postgres',
          }),
        );
        expect(stubs.eventSender.meta).toStrictEqual(
          expect.objectContaining({ dbDialect: 'postgres' }),
        );
      });
    });

    describe('when the connection URL prompt was left blank (empty string)', () => {
      it('should normalize the blank URL to undefined and connect with the fields', async () => {
        expect.assertions(1);

        const config = {
          databaseConnectionURL: '',
          databaseName: 'testDb',
          databaseHost: 'localhost',
          databasePort: 5432,
          databaseUser: 'testUser',
          databasePassword: 'testPwd',
        };
        const commandArgs = [
          'testApp',
          '--applicationHost',
          'localhost',
          '--applicationPort',
          '3300',
          '--databaseSchema',
          'public',
        ];

        const { instance, stubs } = setup(config, commandArgs);

        await instance.run();

        expect(stubs.database.connect).toHaveBeenCalledWith({
          dbConnectionUrl: undefined,
          dbDialect: 'postgres',
          dbHostname: 'localhost',
          dbName: 'testDb',
          dbPassword: 'testPwd',
          dbPort: 5432,
          dbSchema: 'public',
          dbUser: 'testUser',
          mongodbSrv: undefined,
          dbSsl: false,
          dbSslMode: 'disabled',
        });
      });
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
          dbSslMode: 'disabled',
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
            dbSslMode: 'disabled',
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
          dbSslMode: 'disabled',
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
            dbSslMode: 'disabled',
          },
          forestAuthSecret: 'this is an authSecret',
          forestEnvSecret: 'this an envSecret',
          language: languages.Javascript,
        });
      });
    });
  });
});
