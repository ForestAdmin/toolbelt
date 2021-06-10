const testCli = require('./test-cli-helper/test-cli');
const PushCommand = require('../../src/commands/push');
const { enter } = require('../fixtures/std');
const {
  getBranchListValid,
  getDevelopmentEnvironmentValid,
  getEnvironmentListValid,
  getInAppProjectForDevWorkflow,
  getNoBranchListValid,
  getNoEnvironmentListValid,
  getProjectByEnv,
  getProjectListValid,
  getV1ProjectForDevWorkflow,
  pushBranchInvalidDestination,
  pushBranchInvalidDestinationBranch,
  pushBranchInvalidType,
  pushBranchValid,
} = require('../fixtures/api');
const { testEnv, testEnv2 } = require('../fixtures/env');

const getValidProjectEnvironementAndBranch = (projectId, envSecret) => [
  () => getProjectByEnv(),
  () => getInAppProjectForDevWorkflow(projectId),
  () => getDevelopmentEnvironmentValid(projectId),
  () => getBranchListValid(envSecret),
];

describe.only('push', () => {
  describe.only('when the user is logged in', () => {
    describe.only('when no project was provided', () => {
      const projectId = 1;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      const branchName = 'feature/second';
      const environmentName = 'name1';
      it('should display the list of projects', () => testCli({
        env: testEnv,
        token: 'any',
        commandClass: PushCommand,
        api: [
          () => getProjectListValid(),
          () => getInAppProjectForDevWorkflow(projectId),
          () => getDevelopmentEnvironmentValid(),
          () => getBranchListValid(envSecret),
          () => getEnvironmentListValid(projectId),
          () => pushBranchValid(envSecret),
        ],
        prompts: [
          {
            in: [{
              name: 'project',
              message: 'Select your project',
              type: 'list',
              choices: [
                { name: 'project1', value: 1 },
                { name: 'project2', value: 2 },
              ],
            }],
            out: { project: 1 },
          },
          {
            in: [{
              name: 'environment',
              message: 'Select the remote environment you want to push onto',
              type: 'list',
              choices: ['name1'],
            }],
            out: {
              environment: 'name1',
            },
          },
          {
            in: [{
              type: 'confirm',
              name: 'confirm',
              message: 'Push branch feature/second onto name1',
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
    });

    describe('when project was provided', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      const branchName = 'feature/second';
      const environmentName = 'name1';
      it('should not display the list of projects', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['--projectId', '82'],
        api: [
          () => getInAppProjectForDevWorkflow(projectId),
          () => getDevelopmentEnvironmentValid(projectId),
          () => getBranchListValid(envSecret),
          () => getEnvironmentListValid(projectId),
          () => pushBranchValid(envSecret),
        ],
        promptCounts: [1, 1],
        std: [
          { out: 'Select the remote environment you want to push onto' },
          { out: 'name1' },
          ...enter,
          { out: `Push branch ${branchName} onto ${environmentName}` },
          { in: 'y' },
          { out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` },
        ],
      }));
    });

    describe('when destination environment was provided', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      const branchName = 'feature/second';
      const environmentName = 'name1';
      it('should not display the list of environments', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'name1'],
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          () => pushBranchValid(envSecret),
        ],
        promptCounts: [1],
        std: [
          { out: `Push branch ${branchName} onto ${environmentName}` },
          { in: 'y' },
          { out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` },
        ],
      }));
    });

    describe('when force option was provided', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      const branchName = 'feature/second';
      const environmentName = 'name1';
      it('should not display the list of environments', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'name1', '--force'],
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          () => pushBranchValid(envSecret),
        ],
        std: [
          { out: `√ Branch ${branchName} successfully pushed onto ${environmentName}.` },
        ],
      }));
    });

    describe('when answer no on confirm', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      const branchName = 'feature/second';
      const environmentName = 'name1';
      it('should not push branch', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'name1'],
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
        ],
        promptCounts: [1],
        std: [
          { in: 'n' },
          { out: `? Push branch ${branchName} onto ${environmentName} No` },
        ],
      }));
    });

    describe('when development environment doesn\'t have branch', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'name1'],
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
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'name1'],
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

    describe('when destination environment doesn\'t exist', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'notExist', '--force'],
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          () => pushBranchInvalidDestination(envSecret),
        ],
        std: [
          { err: '× The environment provided doesn\'t exist.' },
        ],
        exitCode: 2,
      }));
    });

    describe('when destination environment doesn\'t have type remote', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'noRemote', '--force'],
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          () => pushBranchInvalidType(envSecret),
        ],
        std: [
          { err: '× The environment on which you are trying to push your modifications is not a remote environment.' },
        ],
        exitCode: 2,
      }));
    });

    describe('when destination environment doesn\'t have branch', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        commandArgs: ['-e', 'noRemote', '--force'],
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

    describe('when project doesn\'t have remote environment', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: PushCommand,
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          () => getNoEnvironmentListValid(projectId),
        ],
        std: [
          { err: '× You cannot run this command until this project has a remote non-production environment.' },
        ],
        exitCode: 2,
      }));
    });

    describe('when project is version 1', () => {
      const projectId = 82;
      it('should throw an error', () => testCli({
        env: testEnv2,
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
});
