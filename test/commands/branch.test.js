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
  deleteBranchValid,
  deleteUnknownBranch,
  deleteBranchInvalid,
} = require('../fixtures/api');
const { testEnv2 } = require('../fixtures/env');

describe('branch', () => {
  describe('when the user is logged in', () => {
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

      it('should display a switch to new branch message with a complex branch name', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => BranchCommand.run(['$0m3/$7r4ng38r4nChn4m3!']),
        api: [
          getProjectByEnv(),
          postBranchValid('$0m3/$7r4ng38r4nChn4m3!'),
        ],
        std: [
          { out: '✅ Switched to new branch: $0m3/$7r4ng38r4nChn4m3!.' },
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

    describe('when deleting branches', () => {
      describe('when removing a branch that does not exist', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          command: () => BranchCommand.run(['-d', 'unexistingbranch']),
          api: [
            getProjectByEnv(),
            deleteUnknownBranch('unexistingbranch'),
          ],
          std: [
            { in: 'Y' },
          ],
          exitCode: 2,
          exitMessage: "❌ This branch doesn't exist.",
        }));
      });

      describe('when removing a branch failed', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          command: () => BranchCommand.run(['-d', 'brancherror']),
          api: [
            getProjectByEnv(),
            deleteBranchInvalid('brancherror'),
          ],
          std: [
            { in: 'Y' },
          ],
          exitCode: 2,
          exitMessage: '❌ Failed to delete branch.',
        }));
      });

      describe('when the branch exist', () => {
        describe('when the branch in not the current branch of the environment', () => {
          it('should prompt for confirmation, then remove the branch', () => testCli({
            env: testEnv2,
            token: 'any',
            command: () => BranchCommand.run(['-d', 'existingbranch']),
            api: [
              getProjectByEnv(),
              deleteBranchValid('existingbranch'),
            ],
            std: [
              { in: 'Y' },
              { out: '✅ Branch existingbranch successfully deleted.' },
            ],
          }));

          it('should prompt for confirmation, then do nothing', () => testCli({
            env: testEnv2,
            token: 'any',
            command: () => BranchCommand.run(['-d', 'existingbranch']),
            api: [
              getProjectByEnv(),
            ],
            std: [
              { in: 'n' },
              { out: '' },
            ],
          }));

          describe('using `--force` option', () => {
            it('should display a success branch deleted message', () => testCli({
              env: testEnv2,
              token: 'any',
              command: () => BranchCommand.run(['-d', 'existingbranch', '--force']),
              api: [
                getProjectByEnv(),
                deleteBranchValid('existingbranch'),
              ],
              std: [
                { out: '✅ Branch existingbranch successfully deleted.' },
              ],
            }));
          });
        });
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
