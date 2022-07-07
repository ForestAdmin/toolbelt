const testCli = require('./test-cli-helper/test-cli');
const PushCommand = require('../../src/commands/push');
const {
  getBranchListValid,
  getDevelopmentEnvironmentValid,
  getInAppProjectForDevWorkflow,
  getNoBranchListValid,
  getProjectByEnv,
  getV1ProjectForDevWorkflow,
  pushBranchInvalidDestinationBranch,
  pushBranchValid,
  invalidPushBranchToReference,
} = require('../fixtures/api');
const { testEnvWithSecret } = require('../fixtures/env');

const getValidProjectEnvironementAndBranch = (projectId, envSecret) => [
  () => getProjectByEnv(),
  () => getInAppProjectForDevWorkflow(projectId),
  () => getDevelopmentEnvironmentValid(projectId),
  () => getBranchListValid(envSecret),
];
describe('push', () => {
  describe('when the user use push command', () => {
    const projectId = 82;
    const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
    const branchName = 'feature/second';
    const environmentName = 'Staging';

    it("shouldn't the push if user cancel the confirmation", () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      api: [
        ...getValidProjectEnvironementAndBranch(projectId, envSecret),
      ],
      prompts: [
        {
          in: [{
            name: 'confirm',
            message: `Push branch ${branchName} onto ${environmentName}`,
            type: 'confirm',
          }],
          out: {
            confirm: false,
          },
        },
      ],
      std: [
        { out: '' },
      ],
    }));

    it('should push if user confirm', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      api: [
        ...getValidProjectEnvironementAndBranch(projectId, envSecret),
        () => pushBranchValid(envSecret),
      ],
      prompts: [
        {
          in: [{
            name: 'confirm',
            message: `Push branch ${branchName} onto ${environmentName}`,
            type: 'confirm',
          }],
          out: {
            confirm: true,
          },
        },
      ],
      std: [
        { out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` },
      ],
    }));

    it('should not display the list of environments', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      commandArgs: [],
      api: [
        ...getValidProjectEnvironementAndBranch(projectId, envSecret),
        () => pushBranchValid(envSecret),
      ],
      prompts: [
        {
          in: [{
            name: 'confirm',
            message: `Push branch ${branchName} onto ${environmentName}`,
            type: 'confirm',
          }],
          out: {
            confirm: true,
          },
        },
      ],
      std: [
        { out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` },
      ],
    }));

    it('should skip confirm with --force option', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      commandArgs: ['--force'],
      api: [
        ...getValidProjectEnvironementAndBranch(projectId, envSecret),
        () => pushBranchValid(envSecret),
      ],
      std: [
        { out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` },
      ],
    }));
  });

  describe('when the user try to push on production', () => {
    const projectId = 82;
    const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
    const branchName = 'feature/second';
    const environmentName = 'Staging';

    it("should ask to use the command 'deploy'", () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      api: [
        ...getValidProjectEnvironementAndBranch(projectId, envSecret),
        () => invalidPushBranchToReference(envSecret),
      ],
      prompts: [
        {
          in: [{
            name: 'confirm',
            message: `Push branch ${branchName} onto ${environmentName}`,
            type: 'confirm',
          }],
          out: {
            confirm: true,
          },
        },
      ],
      std: [
        { err: '× Failed to push branch: cannot "push" to reference environment, please use "deploy"' },
      ],
      exitCode: 2,
    }));
  });

  describe('when development environment doesn\'t have branch', () => {
    const projectId = 82;
    const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
    it('should throw an error', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      api: [
        () => getProjectByEnv(),
        () => getInAppProjectForDevWorkflow(projectId),
        () => getDevelopmentEnvironmentValid(projectId),
        () => getNoBranchListValid(envSecret),
      ],
      std: [
        { err: '× You don\'t have any branch to push. Use `forest branch` to create one or use `forest switch` to set your current branch.' },
      ],
      exitCode: 2,
    }));
  });

  describe('when development environment doesn\'t have current branch', () => {
    const projectId = 82;
    const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
    it('should throw an error', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      api: [
        () => getProjectByEnv(),
        () => getInAppProjectForDevWorkflow(projectId),
        () => getDevelopmentEnvironmentValid(projectId),
        () => getBranchListValid(envSecret, false),
      ],
      std: [
        { err: '× You don\'t have any branch to push. Use `forest branch` to create one or use `forest switch` to set your current branch.' },
      ],
      exitCode: 2,
    }));
  });

  describe('when destination environment doesn\'t have branch', () => {
    const projectId = 82;
    const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
    it('should throw an error', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      commandArgs: ['--force'],
      api: [
        ...getValidProjectEnvironementAndBranch(projectId, envSecret),
        () => pushBranchInvalidDestinationBranch(envSecret),
      ],
      std: [
        { err: '× The environment on which you are trying to push your modifications doesn\'t have current branch.' },
      ],
      exitCode: 2,
    }));
  });

  describe('when project is version 1', () => {
    const projectId = 82;
    it('should throw an error', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: PushCommand,
      api: [
        () => getProjectByEnv(),
        () => getV1ProjectForDevWorkflow(projectId),
      ],
      std: [
        { err: '× This project does not support branches yet. Please migrate your environments from your Project settings first.' },
      ],
      exitCode: 2,
    }));
  });
});
