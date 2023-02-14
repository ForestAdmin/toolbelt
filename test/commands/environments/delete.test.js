const chalk = require('chalk');
const { testEnvWithoutSecret } = require('../../fixtures/env');
const {
  getEnvironmentNotFound,
  getEnvironmentValid,
  deleteEnvironment,
  deleteEnvironmentFailure,
} = require('../../fixtures/api');
const testCli = require('../test-cli-helper/test-cli');
const DeleteCommand = require('../../../src/commands/environments/delete');

describe('environments:delete', () => {
  describe('on an existing environment', () => {
    describe('on a succcesful removal', () => {
      it('should display environment deleted', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: DeleteCommand,
          commandArgs: ['324', '--force'],
          api: [() => getEnvironmentValid(), () => deleteEnvironment()],
          std: [{ out: 'Environment Staging successfully deleted.' }],
        }));
    });

    describe('on a failed removal', () => {
      it('should exit with status 1', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: DeleteCommand,
          commandArgs: ['324', '--force'],
          api: [() => getEnvironmentValid(), () => deleteEnvironmentFailure()],
          std: [{ err: '× Oops, something went wrong.' }],
          exitCode: 1,
        }));
    });
  });

  describe('on an unexisting environment', () => {
    it('exit with status 1', () =>
      testCli({
        token: 'any',
        env: testEnvWithoutSecret,
        api: [() => getEnvironmentNotFound()],
        std: [{ err: '× Cannot find the environment 3947.' }],
        commandClass: DeleteCommand,
        commandArgs: ['3947', '--force'],
        exitCode: 1,
      }));
  });

  describe('catch', () => {
    describe('when the error is a 403', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const error = new Error('this is an error ');
        error.status = 403;

        const command = new DeleteCommand();
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

        const command = new DeleteCommand();
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

        const command = new DeleteCommand();
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
