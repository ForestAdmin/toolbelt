const chalk = require('chalk');
const testCli = require('./test-cli-helper/test-cli');
const SwitchCommand = require('../../src/commands/switch');
const {
  getProjectByEnv,
  getBranchListValid,
  getNoBranchListValid,
  updateEnvironmentCurrentBranchId,
} = require('../fixtures/api');
const { testEnvWithSecret } = require('../fixtures/env');

describe('switch', () => {
  describe('when the user is logged in', () => {
    describe('when environment have branches', () => {
      describe('when no branch is specified as an argument', () => {
        it('should display a list of branches then switch to selected branch', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: SwitchCommand,
            api: [
              () => getProjectByEnv(),
              () => getBranchListValid(),
              () => updateEnvironmentCurrentBranchId(),
            ],
            prompts: [
              {
                in: [
                  {
                    name: 'branch',
                    message: 'Select the branch you want to set current',
                    type: 'list',
                    choices: ['feature/first', 'feature/third', 'feature/second'],
                  },
                ],
                out: {
                  branch: 'feature/third',
                },
              },
            ],
            std: [{ out: '√ Switched to branch: feature/third' }],
          }));
      });

      describe('when a valid branch is specified as an argument', () => {
        it('should switch to selected branch', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: SwitchCommand,
            commandArgs: ['feature/third'],
            api: [
              () => getProjectByEnv(),
              () => getBranchListValid(),
              () => updateEnvironmentCurrentBranchId(),
            ],
            std: [{ out: 'Switched to branch: feature/third' }],
          }));
      });

      describe('when an invalid branch is specified as an argument', () => {
        it('should display a list of branches then switch to selected branch', () =>
          testCli({
            env: testEnvWithSecret,
            print: true,
            token: 'any',
            commandClass: SwitchCommand,
            commandArgs: ['not-existing-branch'],
            api: [() => getProjectByEnv(), () => getBranchListValid()],
            std: [{ err: "× This branch doesn't exist." }],
            exitCode: 2,
          }));
      });

      describe('when current branch is specified as an argument', () => {
        it('should display an info message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: SwitchCommand,
            commandArgs: ['feature/second'],
            api: [() => getProjectByEnv(), () => getBranchListValid()],
            std: [{ out: '> feature/second is already your current branch.' }],
          }));
      });
    });

    describe('when environment have no branches', () => {
      it('should display a warning message', () =>
        testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: SwitchCommand,
          api: [() => getProjectByEnv(), () => getNoBranchListValid()],
          std: [
            {
              out: "Δ You don't have any branch to set as current. Use `forest branch <branch_name>` to create one.",
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

        const command = new SwitchCommand();
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

        const command = new SwitchCommand();
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

        const command = new SwitchCommand();
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
