const testCli = require('./test-cli');
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
  getProjectByEnv(),
  getInAppProjectForDevWorkflow(projectId),
  getDevelopmentEnvironmentValid(projectId),
  getBranchListValid(envSecret),
];

describe('push', () => {
  describe('when the user is logged in', () => {
    describe('when no project was provided', () => {
      const projectId = 1;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      const branchName = 'feature/second';
      const environmentName = 'name1';
      it('should display the list of projects', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => PushCommand.run([]),
        api: [
          getProjectListValid(),
          getInAppProjectForDevWorkflow(projectId),
          getDevelopmentEnvironmentValid(),
          getBranchListValid(envSecret),
          getEnvironmentListValid(projectId),
          pushBranchValid(envSecret),
        ],
        std: [
          { out: 'Select your project' },
          { out: 'project1' },
          { out: 'project2' },
          ...enter,
          { out: 'Select the remote environment you want to push onto' },
          { out: 'name1' },
          ...enter,
          { out: `Push branch ${branchName} onto ${environmentName}` },
          { in: 'y' },
          ...enter,
          { out: `✅ Branch ${branchName} successfully pushed onto ${environmentName}.` },
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
        command: () => PushCommand.run(['--projectId', '82']),
        api: [
          getInAppProjectForDevWorkflow(projectId),
          getDevelopmentEnvironmentValid(projectId),
          getBranchListValid(envSecret),
          getEnvironmentListValid(projectId),
          pushBranchValid(envSecret),
        ],
        std: [
          { out: 'Select the remote environment you want to push onto' },
          { out: 'name1' },
          ...enter,
          { out: `Push branch ${branchName} onto ${environmentName}` },
          { in: 'y' },
          ...enter,
          { out: `✅ Branch ${branchName} successfully pushed onto ${environmentName}.` },
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
        command: () => PushCommand.run(['-e', 'name1']),
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          pushBranchValid(envSecret),
        ],
        std: [
          { out: `Push branch ${branchName} onto ${environmentName}` },
          { in: 'y' },
          ...enter,
          { out: `✅ Branch ${branchName} successfully pushed onto ${environmentName}.` },
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
        command: () => PushCommand.run(['-e', 'name1', '--force']),
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          pushBranchValid(envSecret),
        ],
        std: [
          { out: `✅ Branch ${branchName} successfully pushed onto ${environmentName}.` },
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
        command: () => PushCommand.run(['-e', 'name1']),
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
        ],
        std: [
          { in: 'n' },
          ...enter,
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
        command: () => PushCommand.run(['-e', 'name1']),
        api: [
          getProjectByEnv(),
          getInAppProjectForDevWorkflow(projectId),
          getDevelopmentEnvironmentValid(projectId),
          getNoBranchListValid(envSecret),
        ],
        exitCode: 2,
        exitMessage: "⚠️ You don't have any branch to push. Use `forest branch` to create one or use `forest switch` to set your current branch.",
      }));
    });

    describe('when development environment doesn\'t have current branch', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => PushCommand.run(['-e', 'name1']),
        api: [
          getProjectByEnv(),
          getInAppProjectForDevWorkflow(projectId),
          getDevelopmentEnvironmentValid(projectId),
          getBranchListValid(envSecret, false),
        ],
        exitCode: 2,
        exitMessage: "⚠️ You don't have any branch to push. Use `forest branch` to create one or use `forest switch` to set your current branch.",
      }));
    });

    describe('when destination environment doesn\'t exist', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => PushCommand.run(['-e', 'notExist', '--force']),
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          pushBranchInvalidDestination(envSecret),
        ],
        exitCode: 2,
        exitMessage: "❌ The environment provided doesn't exist.",
      }));
    });

    describe('when destination environment doesn\'t have type remote', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => PushCommand.run(['-e', 'noRemote', '--force']),
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          pushBranchInvalidType(envSecret),
        ],
        exitCode: 2,
        exitMessage: '❌ The environment on which you are trying to push your modifications is not a remote environment.',
      }));
    });

    describe('when destination environment doesn\'t have branch', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => PushCommand.run(['-e', 'noRemote', '--force']),
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          pushBranchInvalidDestinationBranch(envSecret),
        ],
        exitCode: 2,
        exitMessage: "❌ The environment on which you are trying to push your modifications doesn't have current branch.",
      }));
    });

    describe('when project doesn\'t have remote environment', () => {
      const projectId = 82;
      const envSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => PushCommand.run([]),
        api: [
          ...getValidProjectEnvironementAndBranch(projectId, envSecret),
          getNoEnvironmentListValid(projectId),
        ],
        exitCode: 2,
        exitMessage: '❌ You cannot run branch commands until this project has a remote environment.',
      }));
    });

    describe('when project is version 1', () => {
      const projectId = 82;
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => PushCommand.run([]),
        api: [
          getProjectByEnv(),
          getV1ProjectForDevWorkflow(projectId),
        ],
        exitCode: 2,
        exitMessage: '⚠️  This project does not support branches yet. Please migrate your environments from your Project settings first.',
      }));
    });
  });
});
