const chalk = require('chalk');
const testCli = require('../test-cli-helper/test-cli');
const CopyLayoutCommand = require('../../../src/commands/environments/copy-layout');
const { testEnvWithoutSecret } = require('../../fixtures/env');
const {
  getEnvironmentValid,
  getEnvironmentValid2,
  postCopyLayout,
  getJob,
  getJobFailed,
  getEnvironmentNotFound,
} = require('../../fixtures/api');

describe('environments:copy-layout', () => {
  describe('on an existing destination environment', () => {
    describe('on a completed job', () => {
      it('should copy the layout', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: CopyLayoutCommand,
          commandArgs: ['325', '324', '-p', '82', '--force'],
          api: [
            () => getEnvironmentValid(),
            () => getEnvironmentValid2(),
            () => postCopyLayout(),
            () => getJob(),
          ],
          assertNoStdError: false,
          std: [{ out: "Environment's layout Production successfully copied to Staging." }],
        }));
    });

    describe('on a failed job', () => {
      it('should exit with status 1', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: CopyLayoutCommand,
          commandArgs: ['325', '324', '-p', '82', '--force'],
          api: [
            () => getEnvironmentValid(),
            () => getEnvironmentValid2(),
            () => postCopyLayout(),
            () => getJobFailed(),
          ],
          std: [{ err: '× Oops, something went wrong.' }],
          exitCode: 1,
        }));
    });
  });

  describe('on an unexisting destination environment', () => {
    it('should exit with status 3', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: CopyLayoutCommand,
        commandArgs: ['325', '324', '-p', '82', '--force'],
        api: [() => getEnvironmentNotFound(324), () => getEnvironmentValid2()],
        std: [{ err: '× Cannot find the target environment 324 on the project 82' }],
        exitCode: 3,
      }));
  });

  describe('catch', () => {
    describe('when the error is a 403', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const error = new Error('this is an error ');
        error.status = 403;

        const command = new CopyLayoutCommand();
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

        const command = new CopyLayoutCommand();
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

        const command = new CopyLayoutCommand();
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
