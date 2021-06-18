const testCli = require('../test-cli-helper/test-cli');
const CreateProjectCommand = require('../../../src/commands/projects/create');
const { testEnv, testEnv2 } = require('../../fixtures/env');
const {
  createProject,
  loginValidOidc,
  updateNewEnvironmentEndpoint,
} = require('../../fixtures/api');

const makePromptInputList = ({ except = null, only = null } = {}) => {
  const allPromptInputs = [
    {
      name: 'databaseDialect',
      message: 'What\'s the database type?',
      type: 'list',
      choices: [
        'mongodb',
        'mssql',
        'mysql',
        'postgres',
      ],
    }, {
      name: 'databaseName',
      type: 'input',
      message: 'What\'s the database name?',
      validate: expect.any(Function),
    }, {
      name: 'databaseSchema',
      type: 'input',
      message: 'What\'s the database schema? [optional]',
      description: 'Leave blank by default',
      default: expect.any(Function),
      when: expect.any(Function),
    }, {
      name: 'databaseHost',
      message: 'What\'s the database hostname?',
      type: 'input',
      default: 'localhost',
    }, {
      name: 'databasePort',
      type: 'input',
      message: 'What\'s the database port?',
      default: expect.any(Function),
      validate: expect.any(Function),
    }, {
      name: 'databaseUser',
      message: 'What\'s the database user?',
      default: expect.any(Function),
      type: 'input',
    }, {
      name: 'databasePassword',
      message: 'What\'s the database password? [optional]',
      type: 'password',
    }, {
      name: 'databaseSSL',
      message: 'Does your database require a SSL connection?',
      type: 'confirm',
      default: false,
    }, {
      name: 'mongoDBSRV',
      message: 'Use a SRV connection string?',
      type: 'confirm',
      default: false,
      when: expect.any(Function),
    }, {
      name: 'applicationHost',
      message: 'What\'s the IP/hostname on which your application will be running?',
      type: 'input',
      default: 'http://localhost',
      validate: expect.any(Function),
    }, {
      name: 'applicationPort',
      message: 'What\'s the port on which your application will be running?',
      type: 'input',
      default: '3310',
      validate: expect.any(Function),
    },
  ];
  let inputs = allPromptInputs;
  if (Array.isArray(expect) && except.length > 0) {
    inputs = inputs.filter((input) => except.indexOf(input.name) === -1);
  }
  if (Array.isArray(only) && only.length > 0) {
    inputs = inputs.filter((input) => only.indexOf(input.name) !== -1);
  }
  return inputs;
};

describe('projects:create', () => {
  describe('login', () => {
    describe('when user is not logged in', () => {
      it('should login', () => testCli({
        commandClass: CreateProjectCommand,
        commandArgs: ['name'],
        env: testEnv,
        api: [
          () => loginValidOidc(),
        ],
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
          { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check\nYour confirmation code: USER-CODE' },
          { out: '> Login successful' },
          { err: '× Connecting to your database' },
        ],
        // This only validates login, options are missing thus the error.
        exitCode: 1,
      }));
    });

    describe('when user is logged in', () => {
      it('should execute command', () => testCli({
        commandClass: CreateProjectCommand,
        commandArgs: ['name'],
        env: testEnv2,
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
        std: [
          { err: '× Connecting to your database' },
        ],
        // This only validates login, options are missing thus the error.
        exitCode: 1,
      }));
    });
  });

  describe('arguments & flags', () => {
    describe('when "applicationName"', () => {
      describe('is missing', () => {
        it('should fail', () => testCli({
          commandClass: CreateProjectCommand,
          env: testEnv2,
          token: 'any',
          // FIXME: CreateProjectCommand.catch not called in this case, enhance testCli.
          exitCode: 2,
        }));
      });

      describe('is provided', () => {
        it('should execute command', () => testCli({
          commandClass: CreateProjectCommand,
          commandArgs: ['name'],
          env: testEnv2,
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
          std: [
            { err: '× Connecting to your database' },
          ],
          // This only validates login, options are missing thus the error.
          exitCode: 1,
        }));
      });
    });

    describe('when "databaseConnectionURL"', () => {
      describe('is missing', () => {
        it('should require database flags via prompts', () => testCli({
          commandClass: CreateProjectCommand,
          commandArgs: ['name'],
          env: testEnv2,
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
          std: [
            { err: '× Connecting to your database' },
          ],
          // This only validates login, options are missing thus the error.
          exitCode: 1,
        }));
      });

      describe('is provided', () => {
        it('should not require database flags via prompts', () => testCli({
          commandClass: CreateProjectCommand,
          commandArgs: ['name', '--databaseConnectionURL', 'postgres://dummy'],
          env: testEnv2,
          token: 'any',
          prompts: [
            {
              in: makePromptInputList({
                only: ['databaseSchema', 'databaseSSL', 'mongoDBSRV', 'applicationHost', 'applicationPort'],
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
            { err: '× Connecting to your database' },
          ],
          // This only validates login, options are missing thus the error.
          exitCode: 1,
        }));
      });
    });
  });

  describe('execution', () => {
    describe('with an existing database', () => {
      it('should generate a project', () => testCli({
        commandClass: CreateProjectCommand,
        commandArgs: ['name'],
        env: testEnv2,
        token: 'any',
        api: [
          () => createProject(),
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
          { err: '√ Connecting to your database' },
          { err: '√ Analyzing the database' },
          { err: '√ Creating your project on Forest Admin' },
          { err: '√ Creating your project files' },
          { out: '√ Hooray, installation success!' },
        ],
        exitCode: 0,
      }));
    });
  });
});
