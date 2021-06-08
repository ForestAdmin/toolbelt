const testCli = require('./test-cli');
const SwitchCommand = require('../../src/commands/switch');
const { enter, arrowDown } = require('../fixtures/std');
const {
  getProjectByEnv,
  getBranchListValid,
  getNoBranchListValid,
  updateEnvironmentCurrentBranchId,
} = require('../fixtures/api');
const { testEnv2 } = require('../fixtures/env');

describe('switch', () => {
  describe('when the user is logged in', () => {
    describe('when environment have branches', () => {
      describe('when no branch is specified as an argument', () => {
        it('should display a list of branches then switch to selected branch', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: SwitchCommand,
          api: [
            () => getProjectByEnv(),
            () => getBranchListValid(),
            () => updateEnvironmentCurrentBranchId(),
          ],
          prompCounts: [1],
          std: [
            { out: 'Select the branch you want to set current' },
            { out: 'feature/first' },
            { out: 'feature/third' },
            { out: 'feature/second' },
            ...arrowDown,
            ...enter,
            { out: 'Switched to branch: feature/third' },
          ],
        }));
      });

      describe('when a valid branch is specified as an argument', () => {
        it('should switch to selected branch', () => testCli({
          env: testEnv2,
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
          env: testEnv2,
          print: true,
          token: 'any',
          commandClass: SwitchCommand,
          commandArgs: ['not-existing-branch'],
          api: [
            () => getProjectByEnv(),
            () => getBranchListValid(),
          ],
          std: [
            { err: "❌ This branch doesn't exist." },
          ],
          exitCode: 2,
        }));
      });

      describe('when current branch is specified as an argument', () => {
        it('should display an info message', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: SwitchCommand,
          commandArgs: ['feature/second'],
          api: [
            () => getProjectByEnv(),
            () => getBranchListValid(),
          ],
          std: [
            { out: 'ℹ️  feature/second is already your current branch.' },
          ],
        }));
      });
    });

    describe('when environment have no branches', () => {
      it('should display a warning message', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: SwitchCommand,
        api: [
          () => getProjectByEnv(),
          () => getNoBranchListValid(),
        ],
        std: [
          { out: "⚠️  You don't have any branch to set as current. Use `forest branch <branch_name>` to create one." },
        ],
      }));
    });
  });
});
