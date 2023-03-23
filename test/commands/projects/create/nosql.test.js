const testCli = require('../../test-cli-helper/test-cli');
const NosqlCommand = require('../../../../src/commands/projects/create/nosql').default;
const { testEnvWithoutSecret, testEnvWithSecret } = require('../../../fixtures/env');
const {
  createProject,
  loginValidOidc,
  updateNewEnvironmentEndpoint,
} = require('../../../fixtures/api');
const complexModel = require('../../../services/analyzer/fixtures/mongo/many-objectid-fields-model');
const MongoHelper = require('../../../services/analyzer/helpers/mongo-helper');
const { DATABASE_URL_MONGODB_MAX } = require('../../../services/analyzer/helpers/database-urls');

const { default: Agents } = require('../../../../src/utils/agents');

const makePromptInputList = ({ except = null, only = null } = {}) => {
  const allPromptInputs = [
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
      type: 'confirm',
      message: 'Use a SRV connection string?',
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

describe('projects:create:nosql', () => {
  describe('login', () => {
    describe('when user is not logged in', () => {
      it('should login', () =>
        testCli({
          commandClass: NosqlCommand,
          commandArgs: ['name'],
          env: testEnvWithoutSecret,
          api: [() => loginValidOidc()],
          prompts: [
            {
              in: makePromptInputList(),
              out: {
                databaseName: 'unknown_db',
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
          commandClass: NosqlCommand,
          commandArgs: ['name'],
          env: testEnvWithSecret,
          token: 'any',
          prompts: [
            {
              in: makePromptInputList(),
              out: {
                confirm: true,
                databaseName: 'unknown_db',
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
            commandClass: NosqlCommand,
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
            commandClass: NosqlCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'mongodb', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList(),
                out: {
                  confirm: true,
                  databaseName: 'unknown_db',
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
            commandClass: NosqlCommand,
            commandArgs: ['name'],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'mongodb', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList(),
                out: {
                  confirm: true,
                  databaseName: 'unknown_db',
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
            commandClass: NosqlCommand,
            commandArgs: [
              'name',
              '--databaseConnectionURL',
              'mongodb://dummy?serverSelectionTimeoutMS=10',
            ],
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => createProject({ databaseType: 'mongodb', agent: Agents.NodeJS }),
              () => updateNewEnvironmentEndpoint(),
            ],
            prompts: [
              {
                in: makePromptInputList({
                  only: ['databaseSchema', 'databaseSSL', 'applicationHost', 'applicationPort'],
                }),
                out: {
                  confirm: true,
                  databaseName: 'unknown_db',
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
        const mongoHelper = await new MongoHelper(DATABASE_URL_MONGODB_MAX);
        await mongoHelper.connect();
        await mongoHelper.dropAllCollections();
        await mongoHelper.given(complexModel);
        await mongoHelper.close();
      });

      it('should generate a project', () =>
        testCli({
          commandClass: NosqlCommand,
          commandArgs: ['name'],
          env: testEnvWithSecret,
          token: 'any',
          api: [
            () => createProject({ databaseType: 'mongodb', agent: Agents.NodeJS }),
            () => updateNewEnvironmentEndpoint(),
          ],
          prompts: [
            {
              in: makePromptInputList(),
              out: {
                databaseName: 'forest-test',
                databaseHost: 'localhost',
                databasePort: 27016,
                databaseUser: '',
                databasePassword: '',
                databaseSSL: false,
              },
            },
          ],
          std: [
            { spinner: '√ Creating your project on Forest Admin' },
            { spinner: '√ Testing connection to your database' },
            { spinner: '√ Creating your project files' },
            { out: '> Hooray, installation success!' },
          ],
          exitCode: 0,
        }));
    });
  });
});
