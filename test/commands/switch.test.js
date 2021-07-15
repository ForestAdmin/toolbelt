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
        it('should display a list of branches then switch to selected branch', () => testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: SwitchCommand,
          api: [
            () => getProjectByEnv(),
            () => getBranchListValid(),
            () => updateEnvironmentCurrentBranchId(),
          ],
          prompts: [{
            in: [{
              name: 'branch',
              message: 'Select the branch you want to set current',
              type: 'list',
              choices: [
                'feature/first',
                'feature/third',
                'feature/second',
              ],
            }],
            out: {
              branch: 'feature/third',
            },
          }],
          std: [
            { out: '√ Switched to branch: feature/third' },
          ],
        }));
      });

      describe('when a valid branch is specified as an argument', () => {
        it('should switch to selected branch', () => testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: SwitchCommand,
          commandArgs: ['feature/third'],
          api: [
            () => getProjectByEnv(),
            () => getBranchListValid(),
            () => updateEnvironmentCurrentBranchId(),
          ],
          std: [
            { out: 'Switched to branch: feature/third' },
          ],
        }));
      });

      describe('when an invalid branch is specified as an argument', () => {
        it('should display a list of branches then switch to selected branch', () => testCli({
          env: testEnvWithSecret,
          print: true,
          token: 'any',
          commandClass: SwitchCommand,
          commandArgs: ['not-existing-branch'],
          api: [
            () => getProjectByEnv(),
            () => getBranchListValid(),
          ],
          std: [
            { err: '× This branch doesn\'t exist.' },
          ],
          exitCode: 2,
        }));
      });

      describe('when current branch is specified as an argument', () => {
        it('should display an info message', () => testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: SwitchCommand,
          commandArgs: ['feature/second'],
          api: [
            () => getProjectByEnv(),
            () => getBranchListValid(),
          ],
          std: [
            { out: '> feature/second is already your current branch.' },
          ],
        }));
      });
    });

    describe('when environment have no branches', () => {
      it('should display a warning message', () => testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: SwitchCommand,
        api: [
          () => getProjectByEnv(),
          () => getNoBranchListValid(),
        ],
        std: [
          { out: 'Δ You don\'t have any branch to set as current. Use `forest branch <branch_name>` to create one.' },
        ],
      }));
    });
  });
});
