const chalk = require('chalk');
const testCli = require('../test-cli-helper/test-cli');
const { testEnvWithoutSecret } = require('../../fixtures/env');
const { updateEnvironmentName, updateEnvironmentEndpoint } = require('../../fixtures/api');
const UpdateCommand = require('../../../src/commands/environments/update');

describe('environments:update', () => {
  describe('with a valid token, environment id and name', () => {
    it('should display "environment updated"', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UpdateCommand,
        commandArgs: ['-e', '182', '-n', 'NewName'],
        api: [() => updateEnvironmentName()],
        std: [{ out: 'Environment updated' }],
      }));
  });

  describe('with a valid token, environment id and apiEnpoint', () => {
    it('should display "environment updated"', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UpdateCommand,
        commandArgs: ['-e', '182', '-u', 'https://super.url.com'],
        api: [() => updateEnvironmentEndpoint()],
        std: [{ out: 'Environment updated' }],
      }));
  });

  describe('with a valid token, environment id but neither name nor apiEndpoint', () => {
    it('should display "Please provide environment name and/or url"', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UpdateCommand,
        commandArgs: ['-e', '182'],
        std: [{ err: '× Please provide environment name and/or url' }],
      }));
  });

  describe('catch', () => {
    describe('when the error is a 403', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const error = new Error('this is an error ');
        error.status = 403;

        const command = new UpdateCommand();
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

        const command = new UpdateCommand();
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

        const command = new UpdateCommand();
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
