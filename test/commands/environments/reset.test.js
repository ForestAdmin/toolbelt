const chalk = require('chalk');
const testCli = require('../test-cli-helper/test-cli');
const ResetCommand = require('../../../src/commands/environments/reset');
const {
  getProjectListValid,
  getDevelopmentEnvironmentValid,
  getEnvironmentListValid,
  resetRemoteEnvironment,
  getProjectByEnv,
  resetRemoteUnexistingEnvironment,
  resetRemoteDisallowedEnvironment,
  resetRemoteEnvironmentFailed,
  getNoEnvironmentListValid,
} = require('../../fixtures/api');
const { testEnvWithoutSecret, testEnvWithSecret } = require('../../fixtures/env');

describe('environments:reset', () => {
  describe('when logged in', () => {
    describe('with not options', () => {
      it('should return prompt for a list of remote environment, ask confirmation and call reset', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: ResetCommand,
          commandArgs: [],
          api: [
            () => getProjectListValid(),
            () => getDevelopmentEnvironmentValid(),
            () => getEnvironmentListValid(1),
            () => resetRemoteEnvironment(),
          ],
          prompts: [
            {
              in: [
                {
                  name: 'project',
                  message: 'Select your project',
                  type: 'list',
                  choices: [
                    { name: 'project1', value: 1 },
                    { name: 'project2', value: 2 },
                  ],
                },
              ],
              out: { project: 1 },
            },
            {
              in: [
                {
                  name: 'environment',
                  message: 'Select the remote environment you want to reset',
                  type: 'list',
                  choices: ['name1'],
                },
              ],
              out: {
                environment: 'name1',
              },
            },
            {
              in: [
                {
                  name: 'confirm',
                  message: 'Reset changes on the environment name1',
                  type: 'confirm',
                },
              ],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            {
              out: 'Environment name1 successfully reset. Please refresh your browser to see the new state.',
            },
          ],
        }));
    });

    describe('when no remote environment is available', () => {
      it('should return prompt for a list of remote environment, ask confirmation and call reset', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: ResetCommand,
          commandArgs: [],
          api: [
            () => getProjectListValid(),
            () => getDevelopmentEnvironmentValid(),
            () => getNoEnvironmentListValid(1),
          ],
          prompts: [
            {
              in: [
                {
                  name: 'project',
                  message: 'Select your project',
                  type: 'list',
                  choices: [
                    { name: 'project1', value: 1 },
                    { name: 'project2', value: 2 },
                  ],
                },
              ],
              out: { project: 1 },
            },
          ],
          std: [{ err: '× No remote environment' }],
          exitCode: 2,
        }));
    });

    describe('with -e/--environmentName option', () => {
      it('should ask confirmation and call reset', () =>
        testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: ResetCommand,
          commandArgs: ['-e', 'name1'],
          api: [() => getProjectByEnv(), () => resetRemoteEnvironment()],
          prompts: [
            {
              in: [
                {
                  name: 'confirm',
                  message: 'Reset changes on the environment name1',
                  type: 'confirm',
                },
              ],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            {
              out: 'Environment name1 successfully reset. Please refresh your browser to see the new state.',
            },
          ],
        }));

      describe('when the environment does not exist', () => {
        it('should forward the error and exit the process with error code 2', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: ResetCommand,
            commandArgs: ['-e', 'name2', '--force'],
            api: [() => getProjectByEnv(), () => resetRemoteUnexistingEnvironment()],
            std: [{ err: '× Environment not found.' }],
            exitCode: 2,
          }));
      });

      describe('when user is not allowed on this environment', () => {
        it('should forward the error and exit the process with error code 2', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: ResetCommand,
            commandArgs: ['-e', 'name2', '--force'],
            api: [() => getProjectByEnv(), () => resetRemoteDisallowedEnvironment()],
            std: [
              { err: '× You do not have the rights to reset the layout of the environment name2' },
            ],
            exitCode: 2,
          }));
      });

      describe('when an unexpected issue happens', () => {
        it('should forward the error and exit the process with error code 2', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: ResetCommand,
            commandArgs: ['-e', 'name2', '--force'],
            api: [() => getProjectByEnv(), () => resetRemoteEnvironmentFailed()],
            std: [{ err: '× Oops something went wrong.' }],
            exitCode: 2,
          }));
      });
    });
  });

  describe('with -f/--force option', () => {
    it('should ask confirmation and call reset', () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: ResetCommand,
        commandArgs: ['-e', 'name1', '--force'],
        api: [() => getProjectByEnv(), () => resetRemoteEnvironment()],
        prompts: [],
        std: [
          {
            out: 'Environment name1 successfully reset. Please refresh your browser to see the new state.',
          },
        ],
      }));
  });

  describe('with -p/--projectId option', () => {
    it('should ask confirmation and call reset', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: ResetCommand,
        commandArgs: ['-p', '1'],
        api: [
          () => getDevelopmentEnvironmentValid(),
          () => getEnvironmentListValid(1),
          () => resetRemoteEnvironment(),
        ],
        prompts: [
          {
            in: [
              {
                name: 'environment',
                message: 'Select the remote environment you want to reset',
                type: 'list',
                choices: ['name1'],
              },
            ],
            out: {
              environment: 'name1',
            },
          },
          {
            in: [
              {
                name: 'confirm',
                message: 'Reset changes on the environment name1',
                type: 'confirm',
              },
            ],
            out: {
              confirm: true,
            },
          },
        ],
        std: [
          {
            out: 'Environment name1 successfully reset. Please refresh your browser to see the new state.',
          },
        ],
      }));
  });

  describe('catch', () => {
    describe('when the error is a 403', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const error = new Error('this is an error ');
        error.status = 403;

        const command = new ResetCommand();
        command.logger = {
          error: jest.fn(),
          log: jest.fn(),
        };

        await expect(() => command.catch(error)).rejects.toThrow('EEXIT: 2');
        expect(command.logger.error).toHaveBeenCalledTimes(1);
        expect(command.logger.error).toHaveBeenCalledWith(
          'You do not have the right to execute this action on this project',
        );
      });
    });

    describe('when the error is a 401', () => {
      it('should log it and exit', async () => {
        expect.assertions(4);

        const error = new Error('this is an error ');
        error.status = 401;

        const command = new ResetCommand();
        command.logger = {
          error: jest.fn(),
          log: jest.fn(),
        };
        // For simplicity. Normally passed via context in `.constructor`.
        command.authenticator = {
          logout: jest.fn(),
        };

        await expect(() => command.catch(error)).rejects.toThrow('EEXIT: 10');
        expect(command.authenticator.logout).toHaveBeenCalledTimes(1);
        expect(command.logger.error).toHaveBeenCalledTimes(1);
        expect(command.logger.error).toHaveBeenCalledWith(
          `Please use '${chalk.bold('forest login')}' to sign in to your Forest account.`,
        );
      });
    });

    describe('when the error is not an authentication error', () => {
      it('should throw the error', async () => {
        expect.assertions(1);

        const error = new Error('this is an error ');
        error.status = 500;

        const command = new ResetCommand();
        command.logger = {
          error: jest.fn(),
          log: jest.fn(),
        };
        // For simplicity. Normally passed via context in `.constructor`.
        command.authenticator = {
          logout: jest.fn(),
        };

        await expect(() => command.catch(error)).rejects.toThrow(error);
      });
    });
  });
});
