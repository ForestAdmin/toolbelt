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

  describe('constructor', () => {
    it('should check and set dependencies', async () => {
      expect.assertions(8);

      const { commandPlan, stubs } = makePlanAndStubs();

      class TestAbstractClass extends AbstractProjectCreateCommand {
        constructor(argv: string[], config: Config, plan) {
          super(argv, config, plan);

          // protected properties are not accessible outside the class
          expect(this.authenticator).toBe(stubs.authenticator);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          expect(this.eventSender).toBe(stubs.eventSender);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          expect(this.commandGenerateConfigGetter).toBe(stubs.commandGenerateConfigGetter);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          expect(this.projectCreator).toBe(stubs.projectCreator);
          expect(this.database).toBe(stubs.database);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          expect(this.messages).toBe(stubs.messages);
          expect(this.spinner).toBe(stubs.spinner);
        }

        // eslint-disable-next-line class-methods-use-this
        createFiles(): Promise<void> {
          throw new Error('Method not implemented.');
        }

        // eslint-disable-next-line class-methods-use-this
        run(): Promise<void> {
          throw new Error('Method not implemented.');
        }
      }

      const testAbstractClass = new TestAbstractClass(
        [],
        new Config({ root: process.cwd() }),
        commandPlan,
      );

      expect(testAbstractClass).toBeInstanceOf(AbstractProjectCreateCommand);
    });
  });

  describe('getConfig', () => {
    class TestAbstractClass extends AbstractProjectCreateCommand {
      static override flags = AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().flags;

      static override args = AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().args;

      static override description =
        AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().description;

      // eslint-disable-next-line class-methods-use-this
      createFiles(): Promise<void> {
        throw new Error('Method not implemented.');
      }

      // eslint-disable-next-line class-methods-use-this
      run(): Promise<void> {
        throw new Error('Method not implemented.');
      }
    }

    describe('with databaseDialect or databaseConnectionUrl', () => {
      let stubs;
      let testAbstractClass: TestAbstractClass;

      // eslint-disable-next-line jest/no-hooks
      beforeAll(() => {
        const planAndStubs = makePlanAndStubs();
        stubs = planAndStubs.stubs;
        stubs.commandGenerateConfigGetter.get.mockResolvedValue({
          applicationName: 'testApp',
          databaseConnectionURL: 'postgres://testUser:testPwd@localhost:5432/testDb',
          applicationHost: 'localhost',
          applicationPort: 3000,
          databaseSchema: 'pubic',
          databaseSSL: false,
          databaseDialect: 'postgres',
        });

        testAbstractClass = new TestAbstractClass(
          [
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
      });

      // it should test that the config is correctly retrieved from the commandGenerateConfigGetter
      it('should set the properties on eventSender', async () => {
        expect.assertions(4);
        await testAbstractClass.getConfig(TestAbstractClass);

        expect(stubs.eventSender.command).toBe('projects:create');
        expect(stubs.eventSender.applicationName).toBe('testApp');
        expect(stubs.eventSender.sessionToken).toBe('authToken');
        expect(stubs.eventSender.meta).toStrictEqual({
          dbDialect: 'postgres',
          agent: 'express-sequelize',
          isLocal: true,
          architecture: 'microservice',
        });
      });

      it('should return appConfig, dbConfig, meta and the authenticationToken', async () => {
        expect.assertions(1);
        const result = await testAbstractClass.getConfig(TestAbstractClass);

        expect(result).toStrictEqual({
          appConfig: {
            applicationName: 'testApp',
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
            dbSchema: 'pubic',
            dbUser: undefined,
            mongodbSrv: undefined,
            ssl: false,
          },
          meta: {
            dbDialect: 'postgres',
            agent: 'express-sequelize',
            isLocal: true,
            architecture: 'microservice',
          },
          authenticationToken: 'authToken',
        });
      });
    });

    describe('without databaseDialect or databaseConnectionUrl', () => {
      let stubs;
      let testAbstractClass: TestAbstractClass;

      // eslint-disable-next-line jest/no-hooks
      beforeAll(() => {
        const planAndStubs = makePlanAndStubs();
        stubs = planAndStubs.stubs;
        stubs.commandGenerateConfigGetter.get.mockResolvedValue({
          applicationName: 'testApp',
          databaseConnectionURL: null,
          databaseDialect: null,
          applicationHost: 'localhost',
          applicationPort: 3000,
          databaseSchema: 'pubic',
          databaseSSL: false,
        });

        testAbstractClass = new TestAbstractClass(
          [
            'testApp',
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
      });

      // it should test that the config is correctly retrieved from the commandGenerateConfigGetter
      it('should set the properties on eventSender', async () => {
        expect.assertions(3);

        await expect(() => testAbstractClass.getConfig(TestAbstractClass)).rejects.toThrow(
          'EEXIT: 1',
        );

        expect(stubs.eventSender.command).toBe('projects:create');
        expect(stubs.eventSender.applicationName).toBe('testApp');
      });

      it('display an error and exit', async () => {
        expect.assertions(3);

        const exitSpy = jest.spyOn(testAbstractClass, 'exit').mockImplementation(() => {
          throw new Error('EEXIT: 1');
        });

        await expect(() => testAbstractClass.getConfig(TestAbstractClass)).rejects.toThrow(
          'EEXIT: 1',
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        expect(testAbstractClass.logger.error).toHaveBeenCalledWith(
          'Missing database dialect option value',
        );
      });
    });

    describe('with a mongodb database', () => {
      let stubs;
      let testAbstractClass: TestAbstractClass;

      // eslint-disable-next-line jest/no-hooks
      beforeAll(() => {
        const planAndStubs = makePlanAndStubs();
        stubs = planAndStubs.stubs;
        stubs.commandGenerateConfigGetter.get.mockResolvedValue({
          applicationName: 'testApp',
          databaseConnectionURL: 'mongodb://testUser:testPwd@localhost:5432',
          applicationHost: 'localhost',
          applicationPort: 3000,
          databaseSSL: false,
          databaseDialect: 'mongodb',
          mongoDbSrv: false,
          ssl: false,
        });

        testAbstractClass = new TestAbstractClass(
          [
            'testApp',
            '--databaseConnectionURL',
            'mongodb://testUser:testPwd@localhost:5432',
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
      });

      // it should test that the config is correctly retrieved from the commandGenerateConfigGetter
      it('should set the properties on eventSender', async () => {
        expect.assertions(4);
        await testAbstractClass.getConfig(TestAbstractClass);

        expect(stubs.eventSender.command).toBe('projects:create');
        expect(stubs.eventSender.applicationName).toBe('testApp');
        expect(stubs.eventSender.sessionToken).toBe('authToken');
        expect(stubs.eventSender.meta).toStrictEqual({
          dbDialect: 'mongodb',
          agent: 'express-mongoose',
          isLocal: true,
          architecture: 'microservice',
        });
      });

      it('should return appConfig, dbConfig, meta and the authenticationToken', async () => {
        expect.assertions(1);
        const result = await testAbstractClass.getConfig(TestAbstractClass);

        expect(result).toStrictEqual({
          appConfig: {
            applicationName: 'testApp',
            appHostname: 'localhost',
            appPort: 3000,
          },
          dbConfig: {
            dbConnectionUrl: 'mongodb://testUser:testPwd@localhost:5432',
            dbDialect: 'mongodb',
            dbHostname: undefined,
            dbName: undefined,
            dbPassword: undefined,
            dbPort: undefined,
            dbSchema: undefined,
            dbUser: undefined,
            mongodbSrv: undefined,
            ssl: false,
          },
          meta: {
            dbDialect: 'mongodb',
            agent: 'express-mongoose',
            isLocal: true,
            architecture: 'microservice',
          },
          authenticationToken: 'authToken',
        });
      });
    });
  });

  describe('testDatabaseConnection', () => {
    class TestAbstractClass extends AbstractProjectCreateCommand {
      // eslint-disable-next-line class-methods-use-this
      createFiles(): Promise<void> {
        throw new Error('Method not implemented.');
      }

      // eslint-disable-next-line class-methods-use-this
      run(): Promise<void> {
        throw new Error('Method not implemented.');
      }
    }

    it('should test the database connection an disconnect', async () => {
      expect.assertions(7);

      const planAndStubs = makePlanAndStubs();

      const testAbstractClass = new TestAbstractClass(
        [],
        new Config({ root: process.cwd() }),
        planAndStubs.commandPlan,
      );

      await testAbstractClass.testDatabaseConnection({
        dbConnectionUrl: 'postgres://testUser:testPwd@localhost:5432/testDb',
        dbDialect: 'postgres',
        dbSchema: 'pubic',
        ssl: false,
      });

      expect(planAndStubs.stubs.spinner.start).toHaveBeenCalledTimes(1);
      expect(planAndStubs.stubs.spinner.start).toHaveBeenCalledWith({
        text: 'Testing connection to your database',
      });
      expect(planAndStubs.stubs.database.connect).toHaveBeenCalledTimes(1);
      expect(planAndStubs.stubs.database.connect).toHaveBeenCalledWith({
        dbConnectionUrl: 'postgres://testUser:testPwd@localhost:5432/testDb',
        dbDialect: 'postgres',
        dbSchema: 'pubic',
        ssl: false,
      });
      expect(planAndStubs.stubs.database.disconnect).toHaveBeenCalledTimes(1);
      expect(planAndStubs.stubs.database.disconnect).toHaveBeenCalledWith('this is a connection');
      expect(planAndStubs.stubs.spinner.attachToPromise).toHaveBeenCalledTimes(1);
    });
  });

  describe('createProject', () => {
    class TestAbstractClass extends AbstractProjectCreateCommand {
      static override flags = AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().flags;

      static override args = AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().args;

      static override description =
        AbstractProjectCreateCommand.makeArgsAndFlagsAndDescription().description;

      // eslint-disable-next-line class-methods-use-this
      createFiles(): Promise<void> {
        throw new Error('Method not implemented.');
      }

      // eslint-disable-next-line class-methods-use-this
      run(): Promise<void> {
        throw new Error('Method not implemented.');
      }
    }

    let stubs;
    let testAbstractClass: TestAbstractClass;

    // eslint-disable-next-line jest/no-hooks
    beforeAll(() => {
      const planAndStubs = makePlanAndStubs();
      stubs = planAndStubs.stubs;
      stubs.commandGenerateConfigGetter.get.mockResolvedValue({
        applicationName: 'testApp',
        databaseConnectionURL: 'postgres://testUser:testPwd@localhost:5432/testDb',
        applicationHost: 'localhost',
        applicationPort: 3000,
        databaseSchema: 'pubic',
        databaseSSL: false,
        databaseDialect: 'postgres',
      });

      stubs.spinner.attachToPromise.mockResolvedValue({
        id: 1,
        envSecret: 'this an envSecret',
        authSecret: 'this is an authSecret',
      });

      testAbstractClass = new TestAbstractClass(
        [
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
    });

    it('should create a project and log it', async () => {
      expect.assertions(4);

      await testAbstractClass.createProject(TestAbstractClass);

      expect(stubs.spinner.start).toHaveBeenCalledTimes(2);
      expect(stubs.spinner.start).toHaveBeenNthCalledWith(1, {
        text: 'Creating your project on Forest Admin',
      });
      expect(stubs.projectCreator.create).toHaveBeenCalledTimes(1);
      expect(stubs.projectCreator.create).toHaveBeenCalledWith(
        'authToken',
        {
          applicationName: 'testApp',
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

    it('should set projectId on eventSender', async () => {
      expect.assertions(1);

      await testAbstractClass.createProject(TestAbstractClass);

      expect(stubs.eventSender.meta).toStrictEqual({
        dbDialect: 'postgres',
        agent: 'express-sequelize',
        isLocal: true,
        architecture: 'microservice',
        projectId: 1,
      });
    });
    it('should return dbConfig, appConfig, forestAuthSecret and forestEnvSecret', async () => {
      expect.assertions(1);

      const result = await testAbstractClass.createProject(TestAbstractClass);

      expect(result).toStrictEqual({
        appConfig: {
          appHostname: 'localhost',
          appPort: 3000,
          applicationName: 'testApp',
        },
        dbConfig: {
          dbConnectionUrl: 'postgres://testUser:testPwd@localhost:5432/testDb',
          dbDialect: 'postgres',
          dbHostname: undefined,
          dbName: undefined,
          dbPassword: undefined,
          dbPort: undefined,
          dbSchema: 'pubic',
          dbUser: undefined,
          mongodbSrv: undefined,
          ssl: false,
        },
        forestAuthSecret: 'this is an authSecret',
        forestEnvSecret: 'this an envSecret',
      });
    });
  });

  describe('notifySuccess', () => {
    class TestAbstractClass extends AbstractProjectCreateCommand {
      // eslint-disable-next-line class-methods-use-this
      createFiles(): Promise<void> {
        throw new Error('Method not implemented.');
      }

      // eslint-disable-next-line class-methods-use-this
      run(): Promise<void> {
        throw new Error('Method not implemented.');
      }
    }

    it('should log the installation success and send the event', async () => {
      expect.assertions(4);

      const planAndStubs = makePlanAndStubs();

      const testAbstractClass = new TestAbstractClass(
        [],
        new Config({ root: process.cwd() }),
        planAndStubs.commandPlan,
      );

      await testAbstractClass.notifySuccess();

      expect(planAndStubs.stubs.logger.info).toHaveBeenCalledTimes(1);
      expect(planAndStubs.stubs.logger.info).toHaveBeenCalledWith('Hooray, installation success!');
      expect(planAndStubs.stubs.chalk.green).toHaveBeenCalledTimes(1);
      expect(planAndStubs.stubs.eventSender.notifySuccess).toHaveBeenCalledTimes(1);
    });
  });
});
