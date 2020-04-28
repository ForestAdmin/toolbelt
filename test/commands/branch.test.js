const testCli = require('./test-cli');
const BranchCommand = require('../../src/commands/branch');
const {
  getProjectByEnv,
  getBranchListValid,
  getNoBranchListValid,
  postBranchValid,
  postBranchInvalid,
  getBranchInvalidEnvironmentV1,
  getBranchInvalidNotDevEnv,
} = require('../fixtures/api');
const { testEnv2 } = require('../fixtures/env');

describe('branch', () => {
  describe('with a logged in user', () => {
    describe('when environment have branches', () => {
      it('should display a list of branches', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => BranchCommand.run([]),
        api: [
          getProjectByEnv(),
          getBranchListValid(),
        ],
        std: [
          { out: 'feature/first' },
          { out: 'feature/second < current branch' },
          { out: 'feature/third' },
        ],
      }));
    });

    describe('when environment does not have branches', () => {
      it('should display a warning message', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => BranchCommand.run([]),
        api: [
          getProjectByEnv(),
          getNoBranchListValid(),
        ],
        std: [
          { out: "⚠️ You don't have any branch yet. Use `forest branch <branch_name>` to create one." },
        ],
      }));
    });

    describe('when creating new branches', () => {
      it('should display a switch to new branch message', () => testCli({
        print: true,
        env: testEnv2,
        token: 'any',
        command: () => BranchCommand.run(['some/randombranchename']),
        api: [
          getProjectByEnv(),
          postBranchValid('some/randombranchename'),
        ],
        std: [
          { out: '✅ Switched to new branch: some/randombranchename.' },
        ],
      }));

      describe('when the branch name already exist', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          command: () => BranchCommand.run(['already/existingbranch']),
          api: [
            getProjectByEnv(),
            postBranchInvalid(),
          ],
          exitCode: 2,
          exitMessage: '❌ This branch already exists.',
        }));
      });
    });

    describe('with errors', () => {
      describe('when environment is not compatible with the dev workflow', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          command: () => BranchCommand.run([]),
          api: [
            getProjectByEnv(),
            getBranchInvalidEnvironmentV1(),
          ],
          exitCode: 2,
          exitMessage: '⚠️  This project does not support branches yet. Please migrate your environments from your Project settings first.',
        }));
      });

      describe('when not running on a development environment', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          command: () => BranchCommand.run([]),
          api: [
            getProjectByEnv(),
            getBranchInvalidNotDevEnv(),
          ],
          exitCode: 2,
          exitMessage: '⚠️  Your development environment is not properly set up. Please run `forest init` first and retry.',
        }));
      });
    });
  });
});
