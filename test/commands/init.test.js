const testCli = require('./test-cli');
const InitCommand = require('../../src/commands/init');
const {
  loginValid,
  getProjectByEnv,
  getInAppProjectForDevWorkflow,
  getDevelopmentEnvironmentValid,
  getProjectListEmpty,
  getProjectListSingleProject,
  getProjectListValid,
  getV1ProjectForDevWorkflow,
  getNoProdProjectForDevWorkflow,
  getProjectNotFoundForDevWorkflow,
} = require('../fixtures/api');
const { testEnv: noKeyEnv, testEnv2 } = require('../fixtures/env');
const { loginPasswordDialog, enter } = require('../fixtures/std');

describe('init command', () => {
  describe('login', () => {
    describe('when user is not logged in', () => {
      it('should prompt a login invitation and go to project selection on success', () => testCli({
        command: () => InitCommand.run([]),
        env: testEnv2,
        api: [
          loginValid(),
          getProjectByEnv(),
          getInAppProjectForDevWorkflow(82),
          getDevelopmentEnvironmentValid(82),
        ],
        std: [
          ...loginPasswordDialog,
          { spinner: 'Selecting your project' },
          { spinner: 'Analyzing your setup' },
          { spinner: 'Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when user is already logged in', () => {
      it('should prompt the project selection', () => testCli({
        command: () => InitCommand.run([]),
        env: testEnv2,
        token: 'any',
        api: [
          getProjectByEnv(),
          getInAppProjectForDevWorkflow(82),
          getDevelopmentEnvironmentValid(82),
        ],
        std: [
          { spinner: 'Selecting your project' },
          { spinner: 'Analyzing your setup' },
          { spinner: 'Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });
  });

  describe('project selection', () => {
    describe('when the project already has an environment secret', () => {
      it('should go to project validation', () => testCli({
        command: () => InitCommand.run([]),
        env: testEnv2,
        token: 'any',
        api: [
          getProjectByEnv(),
          getInAppProjectForDevWorkflow(82),
          getDevelopmentEnvironmentValid(82),
        ],
        std: [
          { spinner: 'Selecting your project' },
          { spinner: 'Analyzing your setup' },
          { spinner: 'Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when the user has no project', () => {
      it('should stop executing with a custom message', () => testCli({
        command: () => InitCommand.run([]),
        env: noKeyEnv,
        token: 'any',
        print: true,
        api: [
          getProjectListEmpty(),
        ],
        exitCode: 1,
        exitMessage: 'You don\'t have any project yet.',
      }));
    });

    describe('when the user has only one project', () => {
      it('should continue executing', () => testCli({
        command: () => InitCommand.run([]),
        env: noKeyEnv,
        token: 'any',
        print: true,
        api: [
          getProjectListSingleProject(),
          getInAppProjectForDevWorkflow(1),
          getDevelopmentEnvironmentValid(1),
        ],
        std: [
          { spinner: 'Selecting your project' },
          { spinner: 'Analyzing your setup' },
          { spinner: 'Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });

    describe('when the user explicitely specify an invalid project', () => {
      it('should stop executing with a custom message', () => testCli({
        command: () => InitCommand.run(['--projectId', '1']),
        env: noKeyEnv,
        token: 'any',
        print: true,
        api: [
          getProjectNotFoundForDevWorkflow(),
        ],
        exitCode: 1,
        exitMessage: 'The project you specified does not exist.',
      }));
    });

    describe('when the user has multiple project', () => {
      it('should prompt a project selection input and go to project validation', () => testCli({
        command: () => InitCommand.run([]),
        env: noKeyEnv,
        token: 'any',
        print: true,
        api: [
          getProjectListValid(),
          getInAppProjectForDevWorkflow(1),
          getDevelopmentEnvironmentValid(1),
        ],
        std: [
          { out: 'Select your project' },
          { out: 'project1' },
          { out: 'project2' },
          ...enter,
          // NOTICE: spinnies outputs to std.err
          { err: 'Selecting your project' },
          { err: 'Analyzing your setup' },
          { err: 'Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });
  });

  describe('project validation', () => {
    describe('when the user has no admin rights on the given project', () => {
      it('should stop executing with a custom error message', () => {
        // TODO
        expect.assertions(0);
      });
    });

    describe('when the project is still flagged as v1', () => {
      it('should stop executing with a custom error message', () => testCli({
        command: () => InitCommand.run([]),
        env: testEnv2,
        token: 'any',
        api: [
          getProjectByEnv(),
          getV1ProjectForDevWorkflow(82),
        ],
        std: [
          { spinner: 'Selecting your project' },
          { spinner: 'Analyzing your setup' },
        ],
        exitCode: 1,
        exitMessage: 'This project does not support branches yet. Please migrate your environments from your Project settings first.',
      }));
    });

    describe('when the project has no prod or remote', () => {
      it('should stop executing with a custom error message', () => testCli({
        command: () => InitCommand.run([]),
        env: testEnv2,
        token: 'any',
        api: [
          getProjectByEnv(),
          getNoProdProjectForDevWorkflow(82),
        ],
        std: [
          { spinner: 'Selecting your project' },
          { spinner: 'Analyzing your setup' },
        ],
        exitCode: 1,
        exitMessage: 'You cannot create your development environment until this project has either a remote or a production environment.',
      }));
    });

    describe('when the project is flagged as v2 and the user is admin on it', () => {
      it('should display a validation green mark and go to database setup', () => testCli({
        command: () => InitCommand.run([]),
        env: noKeyEnv,
        token: 'any',
        print: true,
        api: [
          getProjectListSingleProject(),
          getInAppProjectForDevWorkflow(1),
          getDevelopmentEnvironmentValid(1),
        ],
        std: [
          { spinner: 'Selecting your project' },
          { spinner: 'Analyzing your setup' },
          { spinner: 'Checking your database setup' },
          { out: 'Here are the environment variables you need to copy in your configuration file' },
        ],
      }));
    });
  });

  describe('database setup', () => {
    describe('when the project has an in-app origin', () => {
      it('should go to backend endpoint setup without spinner', () => {
        // TODO
        expect.assertions(0);
      });
    });

    describe('when the project has a lumber origin', () => {
      it('should display a spinner', () => {
        // TODO
        expect.assertions(0);
      });

      describe('when the project .env has a database url', () => {
        it('should display a green mark with the relevant message', () => {
          // TODO
          expect.assertions(0);
        });
      });

      describe('when the project .env file or database url in it', () => {
        it('should display a green mark with the relevant message', () => {
          // TODO
          expect.assertions(0);
        });

        describe('when the user answer positively to specify its credentials', () => {
          it('should display a database detail input', () => {
            // TODO
            expect.assertions(0);
          });
        });

        describe('when the user answer negatively to specify its credentials', () => {
          it('should go to the backend endpoint setup', () => {
            // TODO
            expect.assertions(0);
          });
        });
      });
    });
  });

  describe('backend endpoint setup', () => {
    describe('when the user already have an existing development environment', () => {
      it('should go to the environment variables step', () => {
        // TODO
        expect.assertions(0);
      });
    });

    describe('when the user does not have an existing development environment', () => {
      describe('when the user enters a correct endpoint', () => {
        it('should display a green mark with a relevant message', () => {
          // TODO
          expect.assertions(0);
        });
      });
    });
  });

  describe('environment variables', () => {
    describe('when the project is flagged as in-app and has a .env file', () => {
      it('should display the appropriate spinner', () => {
        // TODO
        expect.assertions(0);
      });

      it('should should copy the env variable in the .env file', () => {
        // TODO
        expect.assertions(0);
      });

      it('should display a green mark with a relevant message', () => {
        // TODO
        expect.assertions(0);
      });
    });

    describe('when the project is NOT flagged as in-app or does not have a .env file', () => {
      it('should display a green mark with a relevant message and environment variables', () => {
        // TODO
        expect.assertions(0);
      });
    });
  });

  describe('all process', () => {
    describe('when  passing through all steps', () => {
      it('should display a green mark with a relevant message', () => {
        // TODO
        expect.assertions(0);
      });
    });
  });
});
