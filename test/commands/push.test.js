const testCli = require('./test-cli-helper/test-cli');
const PushCommand = require('../../src/commands/push');
const {
  getBranchListValid,
  getNoBranchListValid,
  getProjectByEnv,
  pushBranchInvalidDestinationBranch,
  pushBranchValid,
  invalidPushBranchToReference,
  getProjectListValid,
  getDevelopmentEnvironmentValid,
} = require('../fixtures/api');
const { testEnvWithSecret, testEnvWithoutSecret } = require('../fixtures/env');

const getValidProjectEnvironementAndBranch = envSecret => [
  () => getProjectByEnv(),
  () => getBranchListValid(envSecret),
];

describe('push', () => {
  describe('when the user use push command', () => {
    const envSecret = 'forestEnvSecret';
    const branchName = 'feature/second';
    const environmentName = 'Staging';

    it("shouldn't push if user cancel the confirmation", () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        api: [...getValidProjectEnvironementAndBranch(envSecret)],
        prompts: [
          {
            in: [
              {
                name: 'confirm',
                message: `Push branch ${branchName} onto ${environmentName}`,
                type: 'confirm',
              },
            ],
            out: {
              confirm: false,
            },
          },
        ],
        std: [{ out: '' }],
      }));

    it('should push if user confirm', () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        api: [...getValidProjectEnvironementAndBranch(envSecret), () => pushBranchValid(envSecret)],
        prompts: [
          {
            in: [
              {
                name: 'confirm',
                message: `Push branch ${branchName} onto ${environmentName}`,
                type: 'confirm',
              },
            ],
            out: {
              confirm: true,
            },
          },
        ],
        std: [{ out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` }],
      }));

    it('should not display the list of environments', () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: [],
        api: [...getValidProjectEnvironementAndBranch(envSecret), () => pushBranchValid(envSecret)],
        prompts: [
          {
            in: [
              {
                name: 'confirm',
                message: `Push branch ${branchName} onto ${environmentName}`,
                type: 'confirm',
              },
            ],
            out: {
              confirm: true,
            },
          },
        ],
        std: [{ out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` }],
      }));

    it('should skip confirm with --force option', () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['--force'],
        api: [...getValidProjectEnvironementAndBranch(envSecret), () => pushBranchValid(envSecret)],
        std: [{ out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` }],
      }));

    describe('when no env secret was found', () => {
      const secretKey = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should get by default the development environment of the user', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: PushCommand,
          commandArgs: ['--force'],
          api: [
            () => getProjectListValid(),
            () => getDevelopmentEnvironmentValid(),
            () => getBranchListValid(secretKey),
            () => pushBranchValid(secretKey),
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
              out: { project: 1 },
            },
          ],
          std: [{ out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` }],
        }));
    });
  });

  describe('when the user try to push on production', () => {
    const envSecret = 'forestEnvSecret';
    const branchName = 'feature/second';
    const environmentName = 'Staging';

    it("should ask to use the command 'deploy'", () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        api: [
          ...getValidProjectEnvironementAndBranch(envSecret),
          () => invalidPushBranchToReference(envSecret),
        ],
        prompts: [
          {
            in: [
              {
                name: 'confirm',
                message: `Push branch ${branchName} onto ${environmentName}`,
                type: 'confirm',
              },
            ],
            out: {
              confirm: true,
            },
          },
        ],
        std: [
          {
            err: '× Failed to push branch: cannot "push" to reference environment, please use "deploy"',
          },
        ],
        exitCode: 2,
      }));
  });

  describe("when development environment doesn't have branch", () => {
    const envSecret = 'forestEnvSecret';
    it('should throw an error', () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        api: [() => getProjectByEnv(), () => getNoBranchListValid(envSecret)],
        std: [
          {
            err: "× You don't have any branch to push. Use `forest branch` to create one or use `forest switch` to set your current branch.",
          },
        ],
        exitCode: 2,
      }));
  });

  describe("when development environment doesn't have current branch", () => {
    const envSecret = 'forestEnvSecret';
    it('should throw an error', () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        api: [() => getProjectByEnv(), () => getBranchListValid(envSecret, false)],
        std: [
          {
            err: "× You don't have any branch to push. Use `forest branch` to create one or use `forest switch` to set your current branch.",
          },
        ],
        exitCode: 2,
      }));
  });

  describe("when destination environment doesn't have branch", () => {
    const envSecret = 'forestEnvSecret';
    it('should throw an error', () =>
      testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['--force'],
        api: [
          ...getValidProjectEnvironementAndBranch(envSecret),
          () => pushBranchInvalidDestinationBranch(envSecret),
        ],
        std: [
          {
            err: "× The environment on which you are trying to push your modifications doesn't have current branch.",
          },
        ],
        exitCode: 2,
      }));
  });
});
