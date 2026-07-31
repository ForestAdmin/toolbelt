const testCli = require('../../test-cli-helper/test-cli');
const SqlCommand = require('../../../../src/commands/projects/create/sql').default;
const { testEnvWithoutSecret, testEnvWithSecret } = require('../../../fixtures/env');
const {
  createProject,
  loginValidOidc,
  updateNewEnvironmentEndpoint,
} = require('../../../fixtures/api');

const SequelizeHelper = require('../../../services/analyzer/helpers/sequelize-helper');
const { DATABASE_URL_POSTGRESQL_MAX } = require('../../../services/analyzer/helpers/database-urls');
const { default: Agents } = require('../../../../src/utils/agents');
const { default: languages } = require('../../../../src/utils/languages');

const makePromptInputList = ({ except = null, only = null } = {}) => {
  const allPromptInputs = [
    {
      name: 'databaseConnectionURL',
      message: 'Database connection URL (leave blank to enter the details manually):',
      type: 'input',
      validate: expect.any(Function),
    },
    {
      name: 'databaseDialect',
      message: "What's the database type?",
      type: 'list',
      choices: [
        { name: 'mssql', value: 'mssql' },
        { name: 'mysql / mariadb', value: 'mysql' },
        { name: 'postgres', value: 'postgres' },
      ],
      when: expect.any(Function),
    },
    {
      name: 'databaseName',
      type: 'input',
      message: "What's the database name?",
      validate: expect.any(Function),
      when: expect.any(Function),
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
      when: expect.any(Function),
    },
    {
      name: 'databasePort',
      type: 'input',
      message: "What's the database port?",
      default: expect.any(Function),
      validate: expect.any(Function),
      when: expect.any(Function),
    },
    {
      name: 'databaseUser',
      message: "What's the database user?",
      default: expect.any(Function),
      type: 'input',
      when: expect.any(Function),
    },
    {
      name: 'databasePassword',
      message: "What's the database password? [optional]",
      type: 'password',
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
    {
      name: 'language',
      message: 'In which language would you like to generate your sources?',
      type: 'list',
      choices: [
        { name: languages.Javascript.name, value: languages.Javascript },
        { name: languages.Typescript.name, value: languages.Typescript },
      ],
      default: languages.Javascript,
    },
  ];
  let inputs = allPromptInputs;
  if (Array.isArray(except) && except.length > 0) {
    inputs = inputs.filter(input => except.indexOf(input.name) === -1);
  }
  if (Array.isArray(only) && only.length > 0) {
    inputs = inputs.filter(input => only.indexOf(input.name) !== -1);
  }
  return inputs;
};

describe('projects:create:sql', () => {
  describe('login', () => {
    describe('when user is not logged in', () => {
      it('should login', () =>
        testCli({
          commandClass: SqlCommand,
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
                databaseSslMode: 'disabled',
                language: languages.Javascript,
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
          commandClass: SqlCommand,
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
                databaseSslMode: 'disabled',
                language: languages.Javascript,
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
            commandClass: SqlCommand,
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
            commandClass: SqlCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
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
                  databaseSslMode: 'disabled',
                  language: languages.Javascript,
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
            commandClass: SqlCommand,
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
            commandClass: SqlCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
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
                  databaseSslMode: 'disabled',
                  language: languages.Javascript,
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
            commandClass: SqlCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
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
                  databaseSslMode: 'disabled',
                  language: languages.Javascript,
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
            commandClass: SqlCommand,
            commandArgs: ['name', '--databaseConnectionURL', 'postgres://dummy'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList({
                  only: [
                    'databaseSchema',
                    'databaseSSL',
                    'applicationHost',
                    'applicationPort',
                    'language',
                  ],
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
                  databaseSslMode: 'disabled',
                  language: languages.Javascript,
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

      describe('when the database field flags are provided instead', () => {
        // Regression guard for scripted/CI usage: passing the field flags must not
        // surface the new interactive URL question (it would hang in a non-TTY).
        it('should not prompt for the connection URL', () =>
          testCli({
            commandClass: SqlCommand,
            commandArgs: [
              'name',
              '-d',
              'postgres',
              '-n',
              'db',
              '-h',
              'localhost',
              '-p',
              '54999',
              '-u',
              'user',
              '-H',
              'http://localhost',
              '-P',
              '3310',
              '-l',
              'javascript',
            ],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList({ only: ['databaseSchema', 'databasePassword'] }),
                out: {
                  databaseSchema: 'public',
                  databasePassword: 'wrong_password',
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '× Testing connection to your database' },
            ],
            // The database is unreachable on purpose: only the prompt list matters here.
            exitCode: 1,
          }));
      });

      describe('is chosen interactively (blank left to fill fields, or a URL pasted)', () => {
        it('should accept a connection URL and skip the field prompts', () =>
          testCli({
            commandClass: SqlCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList(),
                // Only the URL is answered (no field values) — the dialect (postgres) is derived
                // from it, proving the field prompts were skipped.
                out: {
                  databaseConnectionURL: 'postgres://u:p@unreachable.invalid:5432/db',
                  language: languages.Javascript,
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '× Testing connection to your database' },
            ],
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
          commandClass: SqlCommand,
          commandArgs: ['name'],
          env: testEnvWithSecret,
          token: 'any',
          api: [
            () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
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
                databaseSslMode: 'disabled',
                language: languages.Javascript,
              },
            },
          ],
          std: [
            { spinner: '√ Creating your project on Forest Admin' },
            { spinner: '√ Testing connection to your database' },
            { spinner: '√ Creating your project files' },
            { out: 'create index.js' },
            { out: '> Hooray, installation success!' },
          ],
          exitCode: 0,
        }));

      describe('when the connection URL prompt is left blank', () => {
        // Round-trip of the "blank ⇒ enter the details manually" path: the empty answer
        // must be normalized to undefined so the connection uses the field values.
        it('should fall back to the field prompts and generate the project', () =>
          testCli({
            commandClass: SqlCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList(),
                out: {
                  databaseConnectionURL: '',
                  databaseDialect: 'postgres',
                  databaseName: 'forestadmin_test_toolbelt-sequelize',
                  databaseSchema: 'public',
                  databaseHost: 'localhost',
                  databasePort: 54369,
                  databaseUser: 'forest',
                  databasePassword: 'secret',
                  databaseSSL: false,
                  databaseSslMode: 'disabled',
                  language: languages.Javascript,
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '√ Testing connection to your database' },
              { spinner: '√ Creating your project files' },
              { out: 'create index.js' },
              { out: '> Hooray, installation success!' },
            ],
            exitCode: 0,
          }));
      });

      describe('with language flag set to typescript', () => {
        it('should generate a project in typescript', () =>
          testCli({
            commandClass: SqlCommand,
            commandArgs: ['name', '--language', 'typescript'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList({ except: ['language'] }),
                out: {
                  databaseDialect: 'postgres',
                  databaseName: 'forestadmin_test_toolbelt-sequelize',
                  databaseSchema: 'public',
                  databaseHost: 'localhost',
                  databasePort: 54369,
                  databaseUser: 'forest',
                  databasePassword: 'secret',
                  databaseSSL: false,
                  databaseSslMode: 'disabled',
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '√ Testing connection to your database' },
              { spinner: '√ Creating your project files' },
              { out: 'create index.ts' },
              { out: '> Hooray, installation success!' },
            ],
            exitCode: 0,
          }));
      });

      describe('with language flag set to javascript', () => {
        it('should generate a project in javascript', () =>
          testCli({
            commandClass: SqlCommand,
            commandArgs: ['name', '--language', 'javascript'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'postgres', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList({ except: ['language'] }),
                out: {
                  databaseDialect: 'postgres',
                  databaseName: 'forestadmin_test_toolbelt-sequelize',
                  databaseSchema: 'public',
                  databaseHost: 'localhost',
                  databasePort: 54369,
                  databaseUser: 'forest',
                  databasePassword: 'secret',
                  databaseSSL: false,
                  databaseSslMode: 'disabled',
                },
              },
            ],
            std: [
              { spinner: '√ Creating your project on Forest Admin' },
              { spinner: '√ Testing connection to your database' },
              { spinner: '√ Creating your project files' },
              { out: 'create index.js' },
              { out: '> Hooray, installation success!' },
            ],
            exitCode: 0,
          }));
      });
    });
  });
});
