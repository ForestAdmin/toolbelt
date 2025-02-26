const testCli = require('../test-cli-helper/test-cli');
const CreateProjectCommand = require('../../../src/commands/projects/create').default;
const { testEnvWithoutSecret, testEnvWithSecret } = require('../../fixtures/env');
const {
  createProject,
  loginValidOidc,
  updateNewEnvironmentEndpoint,
} = require('../../fixtures/api');

const SequelizeHelper = require('../../services/analyzer/helpers/sequelize-helper');
const { DATABASE_URL_POSTGRESQL_MAX } = require('../../services/analyzer/helpers/database-urls');

const makePromptInputList = ({ except = null, only = null } = {}) => {
  const allPromptInputs = [
    {
      name: 'databaseDialect',
      message: "What's the database type?",
      type: 'list',
      choices: [
        { name: 'mongodb', value: 'mongodb' },
        { name: 'mssql', value: 'mssql' },
        { name: 'mysql / mariadb', value: 'mysql' },
        { name: 'postgres', value: 'postgres' },
      ],
    },
    {
      name: 'databaseName',
      type: 'input',
      message: "What's the database name?",
      validate: expect.any(Function),
    },
    {
      name: 'databaseSchema',
      type: 'input',
      message: "What's the database schema? [optional]",
      description: 'Leave blank by default',
      default: expect.any(Function),
      when: expect.any(Function),
    },
    {
      name: 'databaseHost',
      message: "What's the database hostname?",
      type: 'input',
      default: 'localhost',
    },
    {
      name: 'databasePort',
      type: 'input',
      message: "What's the database port?",
      default: expect.any(Function),
      validate: expect.any(Function),
    },
    {
      name: 'databaseUser',
      message: "What's the database user?",
      default: expect.any(Function),
      type: 'input',
    },
    {
      name: 'databasePassword',
      message: "What's the database password? [optional]",
      type: 'password',
    },
    {
      name: 'mongoDBSRV',
      message: 'Use a SRV connection string?',
      type: 'confirm',
      default: false,
      when: expect.any(Function),
    },
    {
      name: 'applicationHost',
      message: "What's the IP/hostname on which your application will be running?",
      type: 'input',
      default: 'http://localhost',
      validate: expect.any(Function),
    },
    {
      name: 'applicationPort',
      message: "What's the port on which your application will be running?",
      type: 'input',
      default: '3310',
      validate: expect.any(Function),
    },
  ];
  let inputs = allPromptInputs;
  if (Array.isArray(expect) && except.length > 0) {
    inputs = inputs.filter(input => except.indexOf(input.name) === -1);
  }
  if (Array.isArray(only) && only.length > 0) {
    inputs = inputs.filter(input => only.indexOf(input.name) !== -1);
  }
  return inputs;
};

describe('projects:create', () => {
  describe('login', () => {
    describe('when user is not logged in', () => {
      it('should login', () =>
        testCli({
          commandClass: CreateProjectCommand,
          commandArgs: ['name'],
          env: testEnvWithoutSecret,
          api: [() => loginValidOidc()],
          prompts: [
            {
              in: makePromptInputList(),
              out: {
                databaseDialect: 'postgres',
                databaseName: 'unknown_db',
                databaseSchema: 'public',
                databaseHost: 'unknown_host',
                databasePort: 424242,
                databaseUser: 'no_such_user',
                databasePassword: 'wrong_password',
                databaseSSL: false,
              },
            },
          ],
          std: [
            {
              out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check?code=ABCD\nYour confirmation code: USER-CODE',
            },
            { out: '> Login successful' },
            { spinner: '× Creating your project on Forest Admin' },
          ],
          // This only validates login, options are missing thus the error.
          exitCode: 1,
        }));
    });

    describe('when user is logged in', () => {
      it('should execute command', () =>
        testCli({
          commandClass: CreateProjectCommand,
          commandArgs: ['name'],
          env: testEnvWithSecret,
          token: 'any',
          prompts: [
            {
              in: makePromptInputList(),
              out: {
                confirm: true,
                databaseDialect: 'postgres',
                databaseName: 'unknown_db',
                databaseSchema: 'public',
                databaseHost: 'unknown_host',
                databasePort: 424242,
                databaseUser: 'no_such_user',
                databasePassword: 'wrong_password',
                databaseSSL: false,
              },
            },
          ],
          std: [{ spinner: '× Creating your project on Forest Admin' }],
          // This only validates login, options are missing thus the error.
          exitCode: 1,
        }));
    });
  });

  describe('arguments & flags', () => {
    describe('when "applicationName"', () => {
      describe('is missing', () => {
        it('should fail', () =>
          testCli({
            commandClass: CreateProjectCommand,
            env: testEnvWithSecret,
            token: 'any',
            std: [
              {
                err: '× ["Cannot generate your project.","An unexpected error occurred. Please reach out for help in our Developers community (https://community.forestadmin.com/) or create a Github issue with following error:"]',
              },
            ],
            exitCode: 1,
          }));
      });
      describe('is provided', () => {
        it('should execute command', () =>
          testCli({
            commandClass: CreateProjectCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres' }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList(),
                out: {
                  confirm: true,
                  databaseDialect: 'postgres',
                  databaseName: 'unknown_db',
                  databaseSchema: 'public',
                  databaseHost: 'unknown_host',
                  databasePort: 424242,
                  databaseUser: 'no_such_user',
                  databasePassword: 'wrong_password',
                  databaseSSL: false,
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '× Testing connection to your database' },
            ],
            // This only validates login, options are missing thus the error.
            exitCode: 1,
          }));
      });
    });

    describe('when "databaseDialect"', () => {
      describe('is missing', () => {
        it('should fail', () =>
          testCli({
            commandClass: CreateProjectCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            prompts: [
              {
                in: makePromptInputList(),
                out: {},
              },
            ],
            std: [{ err: '× Missing database dialect option value' }],
            exitCode: 1,
          }));
      });

      describe('is provided', () => {
        it('should execute command', () =>
          testCli({
            commandClass: CreateProjectCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres' }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList(),
                out: {
                  confirm: true,
                  databaseDialect: 'postgres',
                  databaseName: 'unknown_db',
                  databaseSchema: 'public',
                  databaseHost: 'unknown_host',
                  databasePort: 424242,
                  databaseUser: 'no_such_user',
                  databasePassword: 'wrong_password',
                  databaseSSL: false,
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '× Testing connection to your database' },
            ],
            // This only validates login, options are missing thus the error.
            exitCode: 1,
          }));
      });
    });

    describe('when "databaseConnectionURL"', () => {
      describe('is missing', () => {
        it('should require database flags via prompts', () =>
          testCli({
            commandClass: CreateProjectCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres' }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList(),
                out: {
                  confirm: true,
                  databaseDialect: 'postgres',
                  databaseName: 'unknown_db',
                  databaseSchema: 'public',
                  databaseHost: 'unknown_host',
                  databasePort: 424242,
                  databaseUser: 'no_such_user',
                  databasePassword: 'wrong_password',
                  databaseSSL: false,
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '× Testing connection to your database' },
            ],
            // This only validates login, options are missing thus the error.
            exitCode: 1,
          }));
      });

      describe('is provided', () => {
        it('should not require database flags via prompts', () =>
          testCli({
            commandClass: CreateProjectCommand,
            commandArgs: ['name', '--databaseConnectionURL', 'postgres://dummy'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres' }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList({
                  only: ['databaseSchema', 'databaseSSL', 'applicationHost', 'applicationPort'],
                }),
                out: {
                  confirm: true,
                  databaseDialect: 'postgres',
                  databaseName: 'unknown_db',
                  databaseSchema: 'public',
                  databaseHost: 'unknown_host',
                  databasePort: 424242,
                  databaseUser: 'no_such_user',
                  databasePassword: 'wrong_password',
                  databaseSSL: false,
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '× Testing connection to your database' },
            ],
            // This only validates login, options are missing thus the error.
            exitCode: 1,
          }));
      });
    });
  });

  describe('execution', () => {
    describe('with an existing database', () => {
      // eslint-disable-next-line jest/no-hooks
      beforeAll(async () => {
        const sequelizeHelper = new SequelizeHelper();
        await sequelizeHelper.connect(DATABASE_URL_POSTGRESQL_MAX);
        await sequelizeHelper.given('customers');
        await sequelizeHelper.close();
      });

      it('should generate a project', () =>
        testCli({
          commandClass: CreateProjectCommand,
          commandArgs: ['name'],
          env: testEnvWithSecret,
          token: 'any',
          api: [
            () => createProject({ databaseType: 'postgres' }),
            () => updateNewEnvironmentEndpoint(),
          ],
          prompts: [
            {
              in: makePromptInputList(),
              out: {
                databaseDialect: 'postgres',
                databaseName: 'forestadmin_test_toolbelt-sequelize',
                databaseSchema: 'public',
                databaseHost: 'localhost',
                databasePort: 54369,
                databaseUser: 'forest',
                databasePassword: 'secret',
                databaseSSL: false,
              },
            },
          ],
          std: [
            { spinner: '√ Creating your project on Forest Admin' },
            { spinner: '√ Testing connection to your database' },
            { spinner: '√ Analyzing the database' },
            { out: '√ Database is analyzed' },
            { spinner: '√ Creating your project files' },
            { out: '> Hooray, installation success!' },
          ],
          exitCode: 0,
        }));
    });

    describe('with a non-existent schema', () => {
      // eslint-disable-next-line jest/no-hooks
      beforeAll(async () => {
        const sequelizeHelper = new SequelizeHelper();
        await sequelizeHelper.connect(DATABASE_URL_POSTGRESQL_MAX);
        await sequelizeHelper.given('customers');
        await sequelizeHelper.close();
      });

      it('should fail', () =>
        testCli({
          commandClass: CreateProjectCommand,
          commandArgs: ['name'],
          env: testEnvWithSecret,
          token: 'any',
          api: [
            () => createProject({ databaseType: 'postgres' }),
            () => updateNewEnvironmentEndpoint(),
          ],
          prompts: [
            {
              in: makePromptInputList(),
              out: {
                databaseDialect: 'postgres',
                databaseName: 'forestadmin_test_toolbelt-sequelize',
                databaseSchema: 'missing_schema',
                databaseHost: 'localhost',
                databasePort: 54369,
                databaseUser: 'forest',
                databasePassword: 'secret',
                databaseSSL: false,
              },
            },
          ],
          std: [
            { spinner: '√ Creating your project on Forest Admin' },
            { spinner: '√ Testing connection to your database' },
            { err: '× This schema does not exists.' },
          ],
          exitCode: 1,
        }));
    });
  });

  describe('analyzeDatabase', () => {
    const makeContext = () => ({
      assertPresent: jest.fn(),
      database: {
        connect: jest.fn().mockResolvedValue({}),
        disconnect: jest.fn(),
      },
      databaseAnalyzer: {
        analyze: jest.fn(),
        analyzeMongoDb: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        success: jest.fn(),
      },
      spinner: {
        start: jest.fn(),
        attachToPromise: jest.fn(),
      },
    });

    describe('when it is a mongodb dialect', () => {
      it('should analyze the database and display a spinner for the connection only with a log', async () => {
        expect.assertions(9);

        const context = makeContext();
        const { databaseAnalyzer, logger, spinner, database } = context;

        const createCommand = new CreateProjectCommand();
        createCommand.databaseAnalyzer = databaseAnalyzer;
        createCommand.logger = logger;
        createCommand.spinner = spinner;
        createCommand.database = database;

        const dbConfig = { dbDialect: 'mongodb' };
        const connection = {};
        await createCommand.analyzeDatabase(dbConfig);

        expect(database.connect).toHaveBeenCalledTimes(1);
        expect(database.disconnect).toHaveBeenCalledTimes(1);

        expect(databaseAnalyzer.analyzeMongoDb).toHaveBeenCalledTimes(1);
        expect(databaseAnalyzer.analyzeMongoDb).toHaveBeenCalledWith(connection, dbConfig, true);

        expect(spinner.start).toHaveBeenCalledTimes(1);
        expect(spinner.start).toHaveBeenCalledWith({ text: 'Analyzing the database' });
        expect(spinner.attachToPromise).toHaveBeenCalledTimes(1);

        expect(logger.success).toHaveBeenCalledTimes(1);
        expect(logger.success).toHaveBeenCalledWith('Database is analyzed', { lineColor: 'green' });
      });
    });

    describe('when it is not a mongodb dialect', () => {
      it('should analyze the database and display a spinner for the connection and the analysis', async () => {
        expect.assertions(9);

        const context = makeContext();
        const { databaseAnalyzer, logger, spinner, database } = context;

        const createCommand = new CreateProjectCommand();
        createCommand.databaseAnalyzer = databaseAnalyzer;
        createCommand.logger = logger;
        createCommand.spinner = spinner;
        createCommand.database = database;

        const dbConfig = { dbDialect: 'mysqldb' };
        const connection = {};
        await createCommand.analyzeDatabase(dbConfig);

        expect(database.connect).toHaveBeenCalledTimes(1);
        expect(database.disconnect).toHaveBeenCalledTimes(1);

        expect(databaseAnalyzer.analyze).toHaveBeenCalledTimes(1);
        expect(databaseAnalyzer.analyze).toHaveBeenCalledWith(connection, dbConfig, true);

        expect(spinner.start).toHaveBeenCalledTimes(1);
        expect(spinner.start).toHaveBeenCalledWith({ text: 'Analyzing the database' });
        expect(spinner.attachToPromise).toHaveBeenCalledTimes(1);

        expect(logger.success).toHaveBeenCalledTimes(1);
        expect(logger.success).toHaveBeenCalledWith('Database is analyzed', { lineColor: 'green' });
      });
    });
  });
});
