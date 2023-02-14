const chalk = require('chalk');
const testCli = require('../test-cli-helper/test-cli');
const GetProjectCommand = require('../../../src/commands/projects/get').default;
const { testEnvWithoutSecret } = require('../../fixtures/env');
const { getProjectValid } = require('../../fixtures/api');

describe('projects:get', () => {
  describe('on an existing project', () => {
    describe('without json option', () => {
      it('should display the configuration of the Forest project', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: GetProjectCommand,
          commandArgs: ['82'],
          api: [() => getProjectValid()],
          std: [
            { out: 'PROJECT' },
            { out: 'id                   82' },
            { out: 'id                   82' },
            { out: 'name                 Forest' },
            { out: 'default environment  production' },
          ],
        }));
    });

    describe('with json option', () => {
      it('should display the configuration of the Forest project in JSON', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: GetProjectCommand,
          commandArgs: ['82', '--format', 'json'],
          api: [() => getProjectValid()],
          std: [
            {
              out: {
                id: '82',
                name: 'Forest',
                defaultEnvironment: {
                  name: 'Production',
                  apiEndpoint: 'https://api.forestadmin.com',
                  type: 'production',
                  id: '2200',
                },
              },
            },
          ],
        }));
    });
  });

  describe('catch', () => {
    describe('when the error is a 403', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const error = new Error('this is an error ');
        error.status = 403;

        const command = new GetProjectCommand();
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

        const command = new GetProjectCommand();
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

        const command = new GetProjectCommand();
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
