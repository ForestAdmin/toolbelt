/* eslint-disable max-classes-per-file */
import { Config } from '@oclif/config';

import AbstractProjectCreateCommand from '../src/abstract-project-create-command';

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
      },
      logger: {
        error: jest.fn(),
        info: jest.fn(),
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

  describe('runAuthenticated', () => {
    class TestAbstractClass extends AbstractProjectCreateCommand {
      generateProject = jest.fn().mockResolvedValue(null);
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
          'pubic',
        ],
        new Config({ root: process.cwd() }),
        planAndStubs.commandPlan,
      );

      return { stubs: planAndStubs.stubs, instance: testAbstractClass };
    }

    it('should create a project and log progress', async () => {
      expect.assertions(4);

      const { stubs, instance } = setup();

      await instance.runAuthenticated();

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
          agent: 'express-sequelize',
          isLocal: true,
          architecture: 'microservice',
          projectId: 1,
        },
      );
    });
    it('should test that the database is connectable and disconnect', async () => {
      expect.assertions(4);

      const { stubs, instance } = setup();

      await instance.runAuthenticated();

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

      await instance.runAuthenticated();

      expect(instance.generateProject).toHaveBeenCalledTimes(1);
    });
    it('should log the installation success and send the event', async () => {
      expect.assertions(9);

      const { stubs, instance } = setup();

      await instance.runAuthenticated();

      expect(stubs.logger.info).toHaveBeenCalledTimes(1);
      expect(stubs.logger.info).toHaveBeenCalledWith('Hooray, installation success!');
      expect(stubs.chalk.green).toHaveBeenCalledTimes(1);
      expect(stubs.eventSender.meta).toStrictEqual({
        dbDialect: 'postgres',
        agent: 'express-sequelize',
        isLocal: true,
        architecture: 'microservice',
        projectId: 1,
      });
      expect(stubs.eventSender.command).toBe('projects:create');
      expect(stubs.eventSender.applicationName).toBe('testApp');
      expect(stubs.eventSender.sessionToken).toBe('authToken');
      expect(stubs.eventSender.meta).toStrictEqual({
        dbDialect: 'postgres',
        agent: 'express-sequelize',
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

        await instance.runAuthenticated();

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

        await instance.runAuthenticated();

        expect(stubs.eventSender.command).toBe('projects:create');
        expect(stubs.eventSender.applicationName).toBe('testApp');
        expect(stubs.eventSender.sessionToken).toBe('authToken');
        expect(stubs.eventSender.meta).toStrictEqual({
          dbDialect: 'mongodb',
          agent: 'express-mongoose',
          isLocal: true,
          architecture: 'microservice',
          projectId: 1,
        });
      });

      it('call generateProject with the correct properties', async () => {
        expect.assertions(1);

        const { instance } = setup(config, commandArgs);

        await instance.runAuthenticated();

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
        });
      });
    });
    describe('on a sql database', () => {
      it('should test that the database is reachable', async () => {
        expect.assertions(1);

        const { instance, stubs } = setup();

        await instance.runAuthenticated();

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

        await instance.runAuthenticated();

        expect(stubs.eventSender.command).toBe('projects:create');
        expect(stubs.eventSender.applicationName).toBe('testApp');
        expect(stubs.eventSender.sessionToken).toBe('authToken');
        expect(stubs.eventSender.meta).toStrictEqual({
          dbDialect: 'postgres',
          agent: 'express-sequelize',
          isLocal: true,
          architecture: 'microservice',
          projectId: 1,
        });
      });

      it('call generateProject with the correct properties', async () => {
        expect.assertions(1);

        const { instance } = setup();

        await instance.runAuthenticated();

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
        });
      });
    });
  });
});
