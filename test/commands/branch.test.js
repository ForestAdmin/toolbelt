const testCli = require('./test-cli-helper/test-cli');
const BranchCommand = require('../../src/commands/branch');
const {
  getProjectByEnv,
  getBranchListValid,
  getNoBranchListValid,
  postBranchValid,
  postBranchInvalid,
  getBranchInvalidEnvironmentV1,
  getBranchInvalidNotDevEnv,
  getBranchInvalidEnvironmentNoRemote,
  deleteBranchValid,
  deleteUnknownBranch,
  deleteBranchInvalid,
  getDevelopmentEnvironmentValid,
  getDevelopmentEnvironmentNotFound,
  postBranchValidOnSpecificEnv,
} = require('../fixtures/api');
const { testEnv: noKeyEnv, testEnv2 } = require('../fixtures/env');

describe('branch', () => {
  describe('when the user is logged in', () => {
    describe('when environment have branches', () => {
      it('should display a list of branches', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: BranchCommand,
        api: [
          () => getProjectByEnv(),
          () => getBranchListValid(),
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
        commandClass: BranchCommand,
        api: [
          () => getProjectByEnv(),
          () => getNoBranchListValid(),
        ],
        std: [
          { out: 'Δ You don\'t have any branch yet. Use `forest branch <branch_name>` to create one.' },
        ],
      }));
    });

    describe('when creating new branches', () => {
      it('should display a switch to new branch message', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: BranchCommand,
        commandArgs: ['some/randombranchename'],
        api: [
          () => getProjectByEnv(),
          () => postBranchValid('some/randombranchename'),
        ],
        std: [
          { out: '√ Switched to new branch: some/randombranchename.' },
        ],
      }));

      it('should display a switch to new branch message with a complex branch name', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: BranchCommand,
        commandArgs: ['$0m3/$7r4ng38r4nChn4m3!'],
        api: [
          () => getProjectByEnv(),
          () => postBranchValid('$0m3/$7r4ng38r4nChn4m3!'),
        ],
        std: [
          { out: '√ Switched to new branch: $0m3/$7r4ng38r4nChn4m3!.' },
        ],
      }));

      describe('when the branch name already exist', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: BranchCommand,
          commandArgs: ['already/existingbranch'],
          api: [
            () => getProjectByEnv(),
            () => postBranchInvalid(),
          ],
          std: [
            { err: '× This branch already exists.' },
          ],
          exitCode: 2,
        }));
      });

      describe('when no available envSecret', () => {
        describe('when an invalid projectId is provided', () => {
          it('should display an error message', () => testCli({
            env: noKeyEnv,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['--projectId', '1', 'watabranch'],
            api: [
              () => getDevelopmentEnvironmentNotFound(),
            ],
            std: [
              { err: 'Development environment not found.' },
            ],
            exitCode: 2,
          }));
        });

        describe('with a valid projectId', () => {
          it('should display a switch to new branch message', () => testCli({
            env: noKeyEnv,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['--projectId', '1', 'watabranch'],
            api: [
              () => getDevelopmentEnvironmentValid(),
              () => postBranchValidOnSpecificEnv('watabranch', '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125'),
            ],
            std: [
              { out: '√ Switched to new branch: watabranch.' },
            ],
          }));
        });
      });
    });

    describe('when deleting branches', () => {
      describe('when removing a branch that does not exist', () => {
        const branchName = 'unexistingbranch';
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: BranchCommand,
          commandArgs: ['-d', branchName],
          api: [
            () => getProjectByEnv(),
            () => deleteUnknownBranch(branchName),
          ],
          prompts: [
            {
              in: [{
                name: 'confirm',
                message: `Delete branch ${branchName}`,
                type: 'confirm',
              }],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            { err: '× This branch doesn\'t exist.' },
          ],
          exitCode: 2,
        }));
      });

      describe('when removing a branch failed', () => {
        const branchName = 'brancherror';
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: BranchCommand,
          commandArgs: ['-d', branchName],
          api: [
            () => getProjectByEnv(),
            () => deleteBranchInvalid(branchName),
          ],
          prompts: [
            {
              in: [{
                name: 'confirm',
                message: `Delete branch ${branchName}`,
                type: 'confirm',
              }],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            { err: '× Failed to delete branch.' },
          ],
          exitCode: 2,
        }));
      });

      describe('when the branch exist', () => {
        describe('when the branch in not the current branch of the environment', () => {
          const branchName = 'existingbranch';
          it('should prompt for confirmation, then remove the branch if confirmed', () => testCli({
            env: testEnv2,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['-d', branchName],
            api: [
              () => getProjectByEnv(),
              () => deleteBranchValid(branchName),
            ],
            prompts: [
              {
                in: [{
                  name: 'confirm',
                  message: `Delete branch ${branchName}`,
                  type: 'confirm',
                }],
                out: {
                  confirm: true,
                },
              },
            ],
            std: [
              { out: '√ Branch existingbranch successfully deleted.' },
            ],
          }));

          it('should prompt for confirmation, then do nothing if not confirmed', () => testCli({
            env: testEnv2,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['-d', branchName],
            api: [
              () => getProjectByEnv(),
            ],
            prompts: [
              {
                in: [{
                  name: 'confirm',
                  message: `Delete branch ${branchName}`,
                  type: 'confirm',
                }],
                out: {
                  confirm: false,
                },
              },
            ],
            exitCode: 0,
          }));

          describe('using `--force` option', () => {
            it('should display a success branch deleted message', () => testCli({
              env: testEnv2,
              token: 'any',
              commandClass: BranchCommand,
              commandArgs: ['-d', branchName, '--force'],
              api: [
                () => getProjectByEnv(),
                () => deleteBranchValid(branchName),
              ],
              std: [
                { out: '√ Branch existingbranch successfully deleted.' },
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
          commandClass: BranchCommand,
          api: [
            () => getProjectByEnv(),
            () => getBranchInvalidEnvironmentV1(),
          ],
          std: [
            { err: '× This project does not support branches yet. Please migrate your environments from your Project settings first.' },
          ],
          exitCode: 2,
        }));
      });

      describe('when not running on a development environment', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: BranchCommand,
          api: [
            () => getProjectByEnv(),
            () => getBranchInvalidNotDevEnv(),
          ],
          std: [
            { err: '× Your development environment is not properly set up. Please run `forest init` first and retry.' },
          ],
          exitCode: 2,
        }));
      });

      describe('when there is no remote/production environment', () => {
        it('should display an error message', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: BranchCommand,
          api: [
            () => getProjectByEnv(),
            () => getBranchInvalidEnvironmentNoRemote(),
          ],
          std: [
            { err: '× You cannot run branch commands until this project has either a remote or a production environment.' },
          ],
          exitCode: 2,
        }));
      });
    });
  });
});
