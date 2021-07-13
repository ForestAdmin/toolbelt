const testCli = require('./test-cli-helper/test-cli');
const InitCommand = require('../../src/commands/init');
const { validateEndpoint } = require('../../src/services/init-manager');
const {
  getProjectByEnvIncludeLegacy,
  getInAppProjectForDevWorkflow,
  getDevelopmentEnvironmentValid,
  getProjectListEmpty,
  getProjectListSingleProject,
  getProjectListValid,
  getV1ProjectForDevWorkflow,
  getNoProdProjectForDevWorkflow,
  getProjectNotFoundForDevWorkflow,
  getProjectForDevWorkflowUnallowed,
  getForestCLIProjectForDevWorkflow,
  getDevelopmentEnvironmentNotFound,
  createDevelopmentEnvironment,
  loginValidOidc,
} = require('../fixtures/api');
const { testEnvWithoutSecret: noKeyEnv, testEnvWithSecret, testEnvWithSecretAndDatabaseURL } = require('../fixtures/env');

describe('init command', () => {
  describe('login', () => {
    describe('when user is not logged in', () => {
      it('should prompt a login invitation and go to project selection on success', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecret,
        api: [
          () => loginValidOidc(),
          () => getProjectByEnvIncludeLegacy(),
          () => getInAppProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentValid(82),
        ],
        std: [
          { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check?code=ABCD\nYour confirmation code: USER-CODE' },
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when user is already logged in', () => {
      it('should prompt the project selection', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getInAppProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentValid(82),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });
  });

  describe('project selection', () => {
    describe('when the project already has an environment secret', () => {
      it('should go to project validation', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getInAppProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentValid(82),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when the user has no project', () => {
      it('should stop executing with a custom message', () => testCli({
        commandClass: InitCommand,
        env: noKeyEnv,
        token: 'any',
        api: [
          () => getProjectListEmpty(),
        ],
        std: [
          { err: '× You don\'t have any project yet.' },
        ],
        exitCode: 1,
      }));
    });

    describe('when the user has only one project', () => {
      it('should continue executing', () => testCli({
        commandClass: InitCommand,
        env: noKeyEnv,
        token: 'any',
        api: [
          () => getProjectListSingleProject(),
          () => getInAppProjectForDevWorkflow(1),
          () => getDevelopmentEnvironmentValid(1),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when the user explicitely specify an invalid project', () => {
      it('should stop executing with a custom message', () => testCli({
        commandClass: InitCommand,
        commandArgs: (['--projectId', '1']),
        env: noKeyEnv,
        token: 'any',
        api: [
          () => getProjectNotFoundForDevWorkflow(),
        ],
        std: [
          { err: '× The project you specified does not exist.' },
        ],
        exitCode: 1,
      }));
    });

    describe('when the user has multiple projects', () => {
      it('should prompt a project selection input and go to project validation', () => testCli({
        commandClass: InitCommand,
        env: noKeyEnv,
        token: 'any',
        api: [
          () => getProjectListValid(),
          () => getInAppProjectForDevWorkflow(1),
          () => getDevelopmentEnvironmentValid(1),
        ],
        prompts: [{
          in: [{
            name: 'project',
            message: 'Select your project',
            type: 'list',
            choices: [
              { name: 'project1', value: 1 },
              { name: 'project2', value: 2 },
            ],
          }],
          out: { project: 1 },
        }],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });
  });

  describe('project validation', () => {
    describe('when the user has no admin rights on the given project', () => {
      it('should stop executing with a custom error message', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getProjectForDevWorkflowUnallowed(82),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '× Analyzing your setup' },
          { err: '× You need the \'Admin\' role to create a development environment on this project.' },
        ],
        exitCode: 1,
      }));
    });

    describe('when the project is still flagged as v1', () => {
      it('should stop executing with a custom error message', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getV1ProjectForDevWorkflow(82),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '× Analyzing your setup' },
          { err: '× This project does not support branches yet. Please migrate your environments from your Project settings first.' },
        ],
        exitCode: 1,
      }));
    });

    describe('when the project has no prod or remote', () => {
      it('should stop executing with a custom error message', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getNoProdProjectForDevWorkflow(82),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '× Analyzing your setup' },
          { err: '× You cannot create your development environment until this project has either a remote or a production environment.' },
        ],
        exitCode: 1,
      }));
    });

    describe('when the project is flagged as v2 and the user is admin on it', () => {
      it('should display a validation green mark and go to database setup', () => testCli({
        commandClass: InitCommand,
        env: noKeyEnv,
        token: 'any',
        api: [
          () => getProjectListSingleProject(),
          () => getInAppProjectForDevWorkflow(1),
          () => getDevelopmentEnvironmentValid(1),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });
  });

  describe('database setup', () => {
    describe('when the project has an in-app origin', () => {
      it('should go to backend endpoint setup', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecret,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getInAppProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentValid(82),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when the project has a ForestCLI (Lumber) origin', () => {
      describe('when the project .env has a database url', () => {
        it('should continue executing', () => testCli({
          files: [{
            name: '.env',
            content: 'SOMETHING=1',
          }],
          commandClass: InitCommand,
          env: testEnvWithSecretAndDatabaseURL,
          token: 'any',
          api: [
            () => getProjectByEnvIncludeLegacy(),
            () => getForestCLIProjectForDevWorkflow(82),
            () => getDevelopmentEnvironmentValid(82),
          ],
          prompts: [{
            in: [{
              name: 'autoFillOrCreationConfirmation',
              message: 'Do you want your current folder `.env` file to be completed automatically with your environment variables?',
              type: 'confirm',
            }],
            out: {
              confirm: false,
            },
          }],
          std: [
            { spinner: '√ Selecting your project' },
            { spinner: '√ Analyzing your setup' },
            { spinner: '√ Checking your database setup' },
            { spinner: '√ Setting up your development environment' },
            { out: 'Here are the environment variables you need to copy in your configuration file' },
          ],
        }));
      });

      describe('when the project .env file has no database url in it', () => {
        describe('when the user answer positively to specify its credentials', () => {
          it('should display a database detail input and prompt the database credentials as env variables', () => testCli({
            files: [{
              name: '.env',
              content: 'SOMETHING=1',
            }],
            commandClass: InitCommand,
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => getProjectByEnvIncludeLegacy(),
              () => getForestCLIProjectForDevWorkflow(82),
              () => getDevelopmentEnvironmentValid(82),
            ],
            prompts: [
              {
                in: [{
                  name: 'confirm',
                  message: 'You don\'t have a DATABASE_URL yet. Do you need help setting it?',
                  type: 'confirm',
                }],
                out: {
                  confirm: true,
                },
              }, {
                in: [{
                  name: 'databaseDialect',
                  message: 'What\'s the database type?',
                  type: 'list',
                  choices: [
                    'mongodb',
                    'mssql',
                    'mysql',
                    'postgres',
                  ],
                },
                {
                  name: 'databaseName',
                  type: 'input',
                  message: 'What\'s the database name?',
                  validate: expect.any(Function),
                },
                {
                  name: 'databaseSchema',
                  type: 'input',
                  message: 'What\'s the database schema? [optional]',
                  description: 'Leave blank by default',
                  default: expect.any(Function),
                  when: expect.any(Function),
                },
                {
                  name: 'databaseHost',
                  message: 'What\'s the database hostname?',
                  type: 'input',
                  default: 'localhost',
                },
                {
                  name: 'databasePort',
                  type: 'input',
                  message: 'What\'s the database port?',
                  default: expect.any(Function),
                  validate: expect.any(Function),
                },
                {
                  name: 'databaseUser',
                  message: 'What\'s the database user?',
                  default: expect.any(Function),
                  type: 'input',
                },
                {
                  name: 'databasePassword',
                  message: 'What\'s the database password? [optional]',
                  type: 'password',
                },
                {
                  name: 'databaseSSL',
                  message: 'Does your database require a SSL connection?',
                  type: 'confirm',
                  default: false,
                },
                {
                  name: 'mongoDBSRV',
                  message: 'Use a SRV connection string?',
                  type: 'confirm',
                  default: false,
                  when: expect.any(Function),
                }],
                out: {
                  confirm: true,
                  dbDialect: 'postgres',
                  dbName: 'someDbName',
                  dbSchema: 'public',
                  dbHostname: 'localhost',
                  dbPort: 5432,
                  dbUser: 'root',
                  dbPassword: '',
                  ssl: false,
                },
              }, {
                in: [{
                  name: 'autoFillOrCreationConfirmation',
                  message: 'Do you want your current folder `.env` file to be completed automatically with your environment variables?',
                  type: 'confirm',
                }],
                out: {
                  autoFillOrCreationConfirmation: false,
                },
              },
            ],
            std: [
              { spinner: '√ Selecting your project' },
              { spinner: '√ Analyzing your setup' },
              { spinner: '√ Checking your database setup' },
              { out: 'Here are the environment variables you need to copy in your configuration file' },
              { out: 'DATABASE_URL=postgres://root@localhost:5432/someDbName' },
              { out: 'DATABASE_SCHEMA=public' },
              { out: 'DATABASE_SSL=false' },
            ],
          }));
        });

        describe('when the user answer negatively to specify its credentials', () => {
          it('should go to the backend endpoint setup without database credentials as env variables', () => testCli({
            files: [{
              name: '.env',
              content: 'SOMETHING=1',
            }],
            commandClass: InitCommand,
            env: testEnvWithSecret,
            token: 'any',
            api: [
              () => getProjectByEnvIncludeLegacy(),
              () => getForestCLIProjectForDevWorkflow(82),
              () => getDevelopmentEnvironmentValid(82),
            ],
            prompts: [
              {
                in: [{
                  name: 'confirm',
                  message: 'You don\'t have a DATABASE_URL yet. Do you need help setting it?',
                  type: 'confirm',
                }],
                out: {
                  confirm: false,
                },
              }, {
                in: [{
                  name: 'autoFillOrCreationConfirmation',
                  message: 'Do you want your current folder `.env` file to be completed automatically with your environment variables?',
                  type: 'confirm',
                }],
                out: {
                  autoFillOrCreationConfirmation: false,
                },
              },
            ],
            std: [
              { spinner: '√ Selecting your project' },
              { spinner: '√ Analyzing your setup' },
              { spinner: '√ Checking your database setup' },
              { out: 'Here are the environment variables you need to copy in your configuration file' },
            ],
          }));
        });
      });
    });
  });

  describe('backend endpoint setup', () => {
    describe('when the user already have an existing development environment', () => {
      it('should go to the environment variables step', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecretAndDatabaseURL,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getInAppProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentValid(82),
        ],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { spinner: '√ Setting up your development environment' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when the user does not have an existing development environment', () => {
      describe('when the user enters a correct endpoint', () => {
        it('should display a green mark with a relevant message', () => testCli({
          commandClass: InitCommand,
          env: testEnvWithSecretAndDatabaseURL,
          token: 'any',
          api: [
            () => getProjectByEnvIncludeLegacy(),
            () => getInAppProjectForDevWorkflow(82),
            () => getDevelopmentEnvironmentNotFound(82),
            () => createDevelopmentEnvironment(82),
          ],
          prompts: [
            {
              in: [{
                name: 'endpoint',
                message: 'Enter your local admin backend endpoint:',
                type: 'input',
                default: 'http://localhost:3310',
                validate: validateEndpoint,
              }],
              out: {
                endpoint: 'http://localhost:3310',
              },
            },
          ],
          std: [
            { spinner: '√ Selecting your project' },
            { spinner: '√ Analyzing your setup' },
            { spinner: '√ Checking your database setup' },
            { spinner: '√ Setting up your development environment' },
            { out: 'Here are the environment variables you need to copy in your configuration file' },
            { out: 'APPLICATION_PORT=3310' },
          ],
        }));
      });
    });
  });

  describe('environment variables', () => {
    describe('when the project is NOT flagged as in-app and has a .env file', () => {
      it('should copy the env variable in the .env file', () => testCli({
        files: [{
          name: '.env',
          content: 'SOMETHING=1',
        }],
        commandClass: InitCommand,
        env: testEnvWithSecretAndDatabaseURL,
        token: 'any',
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getForestCLIProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentNotFound(82),
          () => createDevelopmentEnvironment(82),
        ],
        prompts: [{
          in: [{
            name: 'endpoint',
            message: 'Enter your local admin backend endpoint:',
            type: 'input',
            default: 'http://localhost:3310',
            validate: validateEndpoint,
          }],
          out: {
            endpoint: 'http://localhost:3310',
          },
        }, {
          in: [{
            name: 'autoFillOrCreationConfirmation',
            message: 'Do you want your current folder `.env` file to be completed automatically with your environment variables?',
            type: 'confirm',
          }],
          out: {
            autoFillOrCreationConfirmation: true,
          },
        }],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { spinner: '√ Copying the environment variables in your `.env` file' },
          // FIXME: Need to assert that env file was amended. In other cases too.
          { spinner: '√ You\'re now set up and ready to develop on Forest Admin' },
          { out: 'To learn more about the recommended usage of this CLI, please visit https://docs.forestadmin.com/documentation/reference-guide/how-it-works/developing-on-forest-admin/forest-cli-commands.' },
        ],
      }));
    });

    describe('when the project is NOT flagged as in-app and does not have a .env file', () => {
      it('should ask if the user wants to create an env file and if not, displays the environment variables', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecretAndDatabaseURL,
        token: 'any',
        print: true,
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getForestCLIProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentNotFound(82),
          () => createDevelopmentEnvironment(82),
        ],
        prompts: [{
          in: [{
            name: 'endpoint',
            message: 'Enter your local admin backend endpoint:',
            type: 'input',
            default: 'http://localhost:3310',
            validate: validateEndpoint,
          }],
          out: {
            endpoint: 'http://localhost:3310',
          },
        }, {
          in: [{
            name: 'autoFillOrCreationConfirmation',
            message: 'Do you want a new `.env` file (containing your environment variables) to be automatically created in your current folder?',
            type: 'confirm',
          }],
          out: {
            autoFillOrCreationConfirmation: false,
          },
        }],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { spinner: '√ Setting up your development environment' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
          { out: 'APPLICATION_PORT=3310' },
          { out: 'FOREST_AUTH_SECRET=' },
          { out: 'FOREST_ENV_SECRET=2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125' },
          { out: 'To learn more about the recommended usage of this CLI, please visit https://docs.forestadmin.com/documentation/reference-guide/how-it-works/developing-on-forest-admin/forest-cli-commands.' },
        ],
      }));

      it('should ask if the user wants to create an env file and if yes, create it', () => testCli({
        commandClass: InitCommand,
        env: testEnvWithSecretAndDatabaseURL,
        token: 'any',
        print: true,
        api: [
          () => getProjectByEnvIncludeLegacy(),
          () => getForestCLIProjectForDevWorkflow(82),
          () => getDevelopmentEnvironmentNotFound(82),
          () => createDevelopmentEnvironment(82),
        ],
        prompts: [{
          in: [{
            name: 'endpoint',
            message: 'Enter your local admin backend endpoint:',
            type: 'input',
            default: 'http://localhost:3310',
            validate: validateEndpoint,
          }],
          out: {
            endpoint: 'http://localhost:3310',
          },
        }, {
          in: [{
            name: 'autoFillOrCreationConfirmation',
            message: 'Do you want a new `.env` file (containing your environment variables) to be automatically created in your current folder?',
            type: 'confirm',
          }],
          out: {
            autoFillOrCreationConfirmation: true,
          },
        }],
        std: [
          { spinner: '√ Selecting your project' },
          { spinner: '√ Analyzing your setup' },
          { spinner: '√ Checking your database setup' },
          { spinner: '√ Setting up your development environment' },
          { spinner: '√ Creating a new `.env` file containing your environment variables' },
          { spinner: '√ You\'re now set up and ready to develop on Forest Admin' },
          { out: 'To learn more about the recommended usage of this CLI, please visit https://docs.forestadmin.com/documentation/reference-guide/how-it-works/developing-on-forest-admin/forest-cli-commands.' },
        ],
      }));
    });
  });
});
