const testCli = require('./test-cli');
const DeployCommand = require('../../src/commands/deploy');
const { enter } = require('../fixtures/std');
const {
  getDevelopmentEnvironmentValid,
  getEnvironmentListValid,
  getProjectByEnv,
  getProjectListValid,
  deployValid,
} = require('../fixtures/api');
const { testEnv, testEnv2 } = require('../fixtures/env');

function inOutDeploySuccessMessage(environmentName) {
  return { out: `✅ Deployed ${environmentName} layout changes to production.` };
}

function inOutConfirmDeploy(environmentName) {
  return [
    { out: `Deploy ${environmentName} layout changes to production?` },
    { in: 'y' },
    ...enter,
    inOutDeploySuccessMessage(environmentName),
  ];
}

function inOutSelectEnvironment(environmentName) {
  return [
    { out: 'Select the environment containing the layout changes you want to deploy' },
    { out: environmentName },
    ...enter,
  ];
}

describe('deploy', () => {
  describe('when the user is logged in', () => {
    describe('when no project was provided', () => {
      const validEnvSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      const environmentName = 'name1';
      it('should display the list of projects', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => DeployCommand.run([]),
        api: [
          getProjectListValid(),
          getDevelopmentEnvironmentValid(1),
          getEnvironmentListValid(1),
          deployValid(validEnvSecret),
        ],
        std: [
          { out: 'Select your project' },
          { out: 'project1' },
          { out: 'project2' },
          ...enter,
          ...inOutSelectEnvironment(environmentName),
          ...inOutConfirmDeploy(environmentName),
        ],
      }));
    });

    describe('when project was provided', () => {
      const projectId = 82;
      const environmentName = 'name1';
      it('should not display the list of projects', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => DeployCommand.run([]),
        api: [
          getProjectByEnv(),
          getEnvironmentListValid(projectId),
          deployValid(),
        ],
        std: [
          ...inOutSelectEnvironment(environmentName),
          ...inOutConfirmDeploy(environmentName),
        ],
      }));
    });

    describe('when destination environment was provided', () => {
      const projectId = 82;
      const environmentName = 'name1';
      it('should not display the list of environments', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => DeployCommand.run([environmentName]),
        api: [
          getProjectByEnv(),
          getEnvironmentListValid(projectId),
          deployValid(),
        ],
        std: inOutConfirmDeploy(environmentName),
      }));
    });

    describe('when force option was provided', () => {
      const projectId = 82;
      const environmentName = 'name1';
      it('should not display the list of environments', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => DeployCommand.run([environmentName, '--force']),
        api: [
          getProjectByEnv(),
          getEnvironmentListValid(projectId),
          deployValid(),
        ],
        std: [inOutDeploySuccessMessage(environmentName)],
      }));
    });

    describe('when answer no on confirm', () => {
      const projectId = 82;
      const environmentName = 'name1';
      it('should not push branch', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => DeployCommand.run([environmentName]),
        api: [
          getProjectByEnv(),
          getEnvironmentListValid(projectId),
        ],
        std: [
          { in: 'n' },
          ...enter,
          { out: `? Deploy ${environmentName} layout changes to production? No` },
        ],
      }));
    });

    describe('when environment doesn\'t exist', () => {
      const projectId = 82;
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => DeployCommand.run(['notExist']),
        api: [
          getProjectByEnv(),
          getEnvironmentListValid(projectId),
        ],
        exitCode: 2,
        exitMessage: "❌ The environment provided doesn't exist.",
      }));
    });
  });
});
