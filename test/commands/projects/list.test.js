const chalk = require('chalk');
const testCli = require('../test-cli-helper/test-cli');
const ListProjectCommand = require('../../../src/commands/projects');
const { testEnvWithoutSecret } = require('../../fixtures/env');
const {
  getProjectDetailledList,
  getProjectofOrganizationDetailledList,
} = require('../../fixtures/api');

describe('projects', () => {
  describe('within an organization', () => {
    it('should return the list of projects within an organization', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: { organizationId: 2 },
        commandClass: ListProjectCommand,
        api: [() => getProjectofOrganizationDetailledList()],
        std: [
          { out: 'PROJECTS' },
          { out: 'ID        NAME' },
          { out: '83        Forest in org' },
          { out: '22        Illustrio in org' },
        ],
      }));
  });

  describe('without json option', () => {
    it('should return the list of projects', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: ListProjectCommand,
        api: [() => getProjectDetailledList()],
        std: [
          { out: 'PROJECTS' },
          { out: 'ID        NAME' },
          { out: '82        Forest' },
          { out: '21        Illustrio' },
        ],
      }));
  });
  describe('with json option', () => {
    it('should return the list of projects in json format', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: ListProjectCommand,
        commandArgs: ['--format', 'json'],
        api: [() => getProjectDetailledList()],
        std: [
          {
            out: [
              {
                id: '82',
                name: 'Forest',
                defaultEnvironment: {
                  id: '2200',
                  name: 'Production',
                  apiEndpoint: 'https://api.forestadmin.com',
                  type: 'production',
                },
              },
              {
                id: '21',
                name: 'Illustrio',
                defaultEnvironment: {
                  id: '39',
                  name: 'Production',
                  apiEndpoint: 'http://dev.illustrio.com:5001',
                  type: 'development',
                },
              },
            ],
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

        const command = new ListProjectCommand();
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

        const command = new ListProjectCommand();
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

        const command = new ListProjectCommand();
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
