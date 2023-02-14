const chalk = require('chalk');
const testCli = require('../test-cli-helper/test-cli');
const { getEnvironmentValid, getEnvironmentNotFound } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');
const GetCommand = require('../../../src/commands/environments/get');

describe('environments:get', () => {
  describe('on an existing environment', () => {
    describe('without JSON format option', () => {
      it('should display the configuration of the Staging environment', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: GetCommand,
          commandArgs: ['324'],
          api: [() => getEnvironmentValid()],
          std: [
            { out: 'id                 324' },
            { out: 'name               Staging' },
            { out: 'url                https://forestadmin-server-staging.herokuapp.com' },
            { out: 'active             true' },
            { out: 'type               development' },
            { out: 'liana              forest-express-sequelize' },
            { out: 'version            1.3.2' },
            {
              out: 'FOREST_ENV_SECRET  2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
            },
          ],
        }));
    });
    describe('with JSON format option', () => {
      it('should display the configuration of the Staging environment', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: GetCommand,
          commandArgs: ['324', '--format', 'json'],
          api: [() => getEnvironmentValid()],
          std: [
            {
              out: {
                name: 'Staging',
                apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
                isActive: true,
                type: 'development',
                lianaName: 'forest-express-sequelize',
                lianaVersion: '1.3.2',
                secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
                id: '324',
              },
            },
          ],
        }));
    });
  });

  describe('on an unknown environment', () => {
    it('should display a NotFound error', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: GetCommand,
        commandArgs: ['3947'],
        api: [() => getEnvironmentNotFound()],
        std: [{ err: '× Cannot find the environment 3947.' }],
      }));
  });

  describe('catch', () => {
    describe('when the error is a 403', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const error = new Error('this is an error ');
        error.status = 403;

        const command = new GetCommand();
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

        const command = new GetCommand();
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

        const command = new GetCommand();
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
