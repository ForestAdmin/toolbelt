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
  getBranchListNoOriginSet,
  getBranchInvalidEnvironmentNoRemote,
  deleteBranchValid,
  deleteUnknownBranch,
  deleteBranchInvalid,
  getDevelopmentEnvironmentNotFound,
  getEnvironmentListValid,
  postBranchInvalidDestination,
  getNoEnvironmentRemoteInList,
  getBranchListForbidden,
} = require('../fixtures/api');
const { testEnvWithoutSecret, testEnvWithSecret } = require('../fixtures/env');

describe('branch', () => {
  describe('when the user is logged in', () => {
    describe('when environment have branches', () => {
      it('should display a list of branches as table', () =>
        testCli({
          env: testEnvWithSecret,
          assertNoStdError: false,
          token: 'any',
          commandClass: BranchCommand,
          api: [() => getProjectByEnv(), () => getBranchListValid()],
          std: [
            { out: 'BRANCHES' },
            { out: 'NAME                ORIGIN              IS CURRENT          CLOSED AT' },
            {
              out: 'feature/first       Staging                                 2022-06-28T13:15:43.513Z',
            },
            { out: 'feature/second      Staging             ✅' },
            { out: 'feature/third       Production' },
          ],
        }));

      it('should display a branch with no origin set', () =>
        testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: BranchCommand,
          api: [() => getProjectByEnv(), () => getBranchListNoOriginSet()],
          std: [
            { out: 'BRANCHES' },
            { out: 'NAME                ORIGIN              IS CURRENT          CLOSED AT' },
            {
              out: 'feature/first       ⚠️  No origin set                       2022-06-28T13:15:43.513Z',
            },
          ],
        }));

      it('should display a list of branches as json', () =>
        testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: BranchCommand,
          commandArgs: ['--format', 'json'],
          api: [() => getProjectByEnv(), () => getBranchListValid()],
          std: [
            {
              out: [
                {
                  name: 'feature/first',
                  closedAt: '2022-06-28T13:15:43.513Z',
                  originEnvironment: {
                    id: '324',
                    name: 'Staging',
                  },
                },
                {
                  name: 'feature/second',
                  isCurrent: true,
                  originEnvironment: {
                    id: '324',
                    name: 'Staging',
                  },
                },
                {
                  name: 'feature/third',
                  originEnvironment: {
                    id: '325',
                    name: 'Production',
                  },
                },
              ],
            },
          ],
        }));
    });

    describe('when environment does not have branches', () => {
      it('should display a warning message', () =>
        testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: BranchCommand,
          api: [() => getProjectByEnv(), () => getNoBranchListValid()],
          std: [
            {
              out: "Δ You don't have any branch yet. Use `forest branch <branch_name>` to create one.",
            },
          ],
        }));
    });

    describe('when creating new branches', () => {
      it('should ask for origin if not provided and display a switch to new branch message', () =>
        testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: BranchCommand,
          commandArgs: ['some/randombranchename'],
          api: [
            () => getProjectByEnv(),
            () => getEnvironmentListValid(82),
            () => postBranchValid('some/randombranchename'),
          ],
          prompts: [
            {
              in: [
                {
                  name: 'environment',
                  message: 'Select the remote environment you want as origin',
                  type: 'list',
                  choices: ['name1', 'name2', 'test'],
                },
              ],
              out: {
                environment: 'name1',
              },
            },
          ],
          std: [{ out: '√ Switched to new branch: some/randombranchename.' }],
        }));

      it('should display a switch to new branch message with a complex branch name', () =>
        testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: BranchCommand,
          commandArgs: ['$0m3/$7r4ng38r4nChn4m3!', '--origin', 'name1'],
          api: [() => getProjectByEnv(), () => postBranchValid('$0m3/$7r4ng38r4nChn4m3!')],

          std: [{ out: '√ Switched to new branch: $0m3/$7r4ng38r4nChn4m3!.' }],
        }));

      describe('when creating new branches with an inexisting environment as origin', () => {
        it('should display an error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['some/randombranchename', '--origin', 'inexistingEnvironment'],
            api: [() => getProjectByEnv(), () => postBranchInvalidDestination()],
            std: [{ err: "× The environment provided doesn't exist." }],
            exitCode: 2,
          }));
      });

      describe('when the branch name already exist', () => {
        it('should display an error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['already/existingbranch', '--origin', 'name1'],
            api: [() => getProjectByEnv(), () => postBranchInvalid()],
            std: [{ err: '× This branch already exists.' }],
            exitCode: 2,
          }));
      });

      describe('when no available envSecret', () => {
        describe('when an invalid projectId is provided', () => {
          it('should display an error message', () =>
            testCli({
              env: testEnvWithoutSecret,
              token: 'any',
              commandClass: BranchCommand,
              commandArgs: ['--projectId', '1', 'watabranch'],
              api: [() => getDevelopmentEnvironmentNotFound()],
              std: [{ err: '× Development environment not found.' }],
              exitCode: 2,
            }));
        });
      });
    });

    describe('when deleting branches', () => {
      describe('when removing a branch that does not exist', () => {
        const branchName = 'unexistingbranch';
        it('should display an error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['-d', branchName],
            api: [() => getProjectByEnv(), () => deleteUnknownBranch(branchName)],
            prompts: [
              {
                in: [
                  {
                    name: 'confirm',
                    message: `Delete branch ${branchName}`,
                    type: 'confirm',
                  },
                ],
                out: {
                  confirm: true,
                },
              },
            ],
            std: [{ err: "× This branch doesn't exist." }],
            exitCode: 2,
          }));
      });

      describe('when removing a branch failed', () => {
        const branchName = 'brancherror';
        it('should display an error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['-d', branchName],
            api: [() => getProjectByEnv(), () => deleteBranchInvalid(branchName)],
            prompts: [
              {
                in: [
                  {
                    name: 'confirm',
                    message: `Delete branch ${branchName}`,
                    type: 'confirm',
                  },
                ],
                out: {
                  confirm: true,
                },
              },
            ],
            std: [{ err: '× Failed to delete branch.' }],
            exitCode: 2,
          }));
      });

      describe('when the branch exist', () => {
        describe('when the branch in not the current branch of the environment', () => {
          const branchName = 'existingbranch';
          it('should prompt for confirmation, then remove the branch if confirmed', () =>
            testCli({
              env: testEnvWithSecret,
              token: 'any',
              commandClass: BranchCommand,
              commandArgs: ['-d', branchName],
              api: [() => getProjectByEnv(), () => deleteBranchValid(branchName)],
              prompts: [
                {
                  in: [
                    {
                      name: 'confirm',
                      message: `Delete branch ${branchName}`,
                      type: 'confirm',
                    },
                  ],
                  out: {
                    confirm: true,
                  },
                },
              ],
              std: [{ out: '√ Branch existingbranch successfully deleted.' }],
            }));

          it('should prompt for confirmation, then do nothing if not confirmed', () =>
            testCli({
              env: testEnvWithSecret,
              token: 'any',
              commandClass: BranchCommand,
              commandArgs: ['-d', branchName],
              api: [() => getProjectByEnv()],
              prompts: [
                {
                  in: [
                    {
                      name: 'confirm',
                      message: `Delete branch ${branchName}`,
                      type: 'confirm',
                    },
                  ],
                  out: {
                    confirm: false,
                  },
                },
              ],
              exitCode: 0,
            }));

          // eslint-disable-next-line jest/max-nested-describe
          describe('using `--force` option', () => {
            it('should display a success branch deleted message', () =>
              testCli({
                env: testEnvWithSecret,
                token: 'any',
                commandClass: BranchCommand,
                commandArgs: ['-d', branchName, '--force'],
                api: [() => getProjectByEnv(), () => deleteBranchValid(branchName)],
                std: [{ out: '√ Branch existingbranch successfully deleted.' }],
              }));
          });
        });
      });
    });

    describe('with errors', () => {
      describe('when environment is not compatible with the dev workflow', () => {
        it('should display an error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            api: [() => getProjectByEnv(), () => getBranchInvalidEnvironmentV1()],
            std: [
              {
                err: '× This project does not support branches yet. Please migrate your environments from your Project settings first.',
              },
            ],
            exitCode: 2,
          }));
      });

      describe('when not running on a development environment', () => {
        it('should display an error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            api: [() => getProjectByEnv(), () => getBranchInvalidNotDevEnv()],
            std: [{ err: "× The remote environments can't have additional branches." }],
            exitCode: 2,
          }));
      });

      describe('when there is no remote/production environment', () => {
        it('should display an error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            api: [() => getProjectByEnv(), () => getBranchInvalidEnvironmentNoRemote()],
            std: [
              {
                err: '× You cannot run branch commands until this project has either a remote or a production environment.',
              },
            ],
            exitCode: 2,
          }));

        it('should throw an error if only development environements in askForEnvionement function return', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: ['newBranchName'],
            api: [() => getProjectByEnv(), () => getNoEnvironmentRemoteInList(82)],
            std: [
              {
                err: '× You cannot run branch commands until this project has either a remote or a production environment.',
              },
            ],
            exitCode: 2,
          }));
      });

      describe('when the user has no admin rights on the given project', () => {
        it('should stop executing with a custom error message', () =>
          testCli({
            env: testEnvWithSecret,
            token: 'any',
            commandClass: BranchCommand,
            commandArgs: [],
            api: [() => getProjectByEnv(), () => getBranchListForbidden()],
            std: [
              {
                err: "× You need the 'Admin' or 'Developer' permission level on this project to use branches.",
              },
            ],
            exitCode: 2,
          }));
      });
    });
  });
});
