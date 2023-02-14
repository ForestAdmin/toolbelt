const chalk = require('chalk');
const testCli = require('./test-cli-helper/test-cli');
const EnvironmentCommand = require('../../src/commands/environments');
const { testEnvWithoutSecret } = require('../fixtures/env');
const {
  getProjectListValid,
  getEnvironmentListValid,
  loginValidOidc,
  getEnvironmentListWithoutApiEndpoint,
} = require('../fixtures/api');

describe('environments', () => {
  it('should display environment list', () =>
    testCli({
      env: testEnvWithoutSecret,
      commandClass: EnvironmentCommand,
      api: [() => loginValidOidc(), () => getProjectListValid(), () => getEnvironmentListValid()],
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
          out: { project: 2 },
        },
      ],
      std: [
        { out: '> Login required.' },
        {
          out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check',
        },
        { out: 'Your confirmation code: USER-CODE' },
        { out: '> Login successful' },
        { out: 'ENVIRONMENTS' },
        { out: 'ID        NAME                URL                                TYPE' },
        { out: '3         name1               http://localhost:1                 remote' },
        { out: '4         name2               http://localhost:2                 production' },
      ],
    }));

  describe('when apiEndpoint is null because the onboarding is not finished', () => {
    it('should display environment list', () =>
      testCli({
        env: testEnvWithoutSecret,
        commandClass: EnvironmentCommand,
        api: [
          () => loginValidOidc(),
          () => getProjectListValid(),
          () => getEnvironmentListWithoutApiEndpoint(),
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
            out: { project: 2 },
          },
        ],
        std: [
          { out: '> Login required.' },
          {
            out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check',
          },
          { out: 'Your confirmation code: USER-CODE' },
          { out: '> Login successful' },
          { out: 'ENVIRONMENTS' },
          { out: 'ID        NAME                URL                                TYPE' },
          { out: '3         name1                                                  remote' },
        ],
      }));
  });

  describe('catch', () => {
    describe('when the error is a 403', () => {
      it('should log it and exit', async () => {
        expect.assertions(3);

        const error = new Error('this is an error ');
        error.status = 403;

        const command = new EnvironmentCommand();
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

        const command = new EnvironmentCommand();
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

        const command = new EnvironmentCommand();
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
