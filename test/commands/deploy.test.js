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
  return { out: `✅ Deployed ${environmentName} layout changes to reference environment.` };
}

function inOutConfirmDeploy(environmentName) {
  return [
    { out: `Deploy ${environmentName} layout changes to reference?` },
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
        commandClass: DeployCommand,
        api: [
          () => getProjectListValid(),
          () => getDevelopmentEnvironmentValid(1),
          () => getEnvironmentListValid(1),
          () => deployValid(validEnvSecret),
        ],
        promptCounts: [1, 1, 1],
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
      describe('using command line', () => {
        const projectId = 82;
        const environmentName = 'name1';
        it('should not display the list of projects', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: DeployCommand,
          commandArgs: ['-p', '82'],
          api: [
            () => getEnvironmentListValid(projectId),
            () => deployValid(),
          ],
          promptCounts: [1, 1],
          std: [
            ...inOutSelectEnvironment(environmentName),
            ...inOutConfirmDeploy(environmentName),
          ],
        }));
      });

      describe('guessed from FOREST_ENV_SECRET', () => {
        const projectId = 82;
        const environmentName = 'name1';
        it('should not display the list of projects', () => testCli({
          env: testEnv2,
          token: 'any',
          commandClass: DeployCommand,
          api: [
            () => getProjectByEnv(),
            () => getEnvironmentListValid(projectId),
            () => deployValid(),
          ],
          promptCounts: [1, 1],
          std: [
            ...inOutSelectEnvironment(environmentName),
            ...inOutConfirmDeploy(environmentName),
          ],
        }));
      });
    });

    describe('when destination environment was provided', () => {
      const projectId = 82;
      const environmentName = 'name1';
      it('should not display the list of environments', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: DeployCommand,
        commandArgs: [environmentName],
        api: [
          () => getProjectByEnv(),
          () => getEnvironmentListValid(projectId),
          () => deployValid(),
        ],
        promptCounts: [1],
        std: inOutConfirmDeploy(environmentName),
      }));
    });

    describe('when force option was provided', () => {
      const projectId = 82;
      const environmentName = 'name1';
      it('should not display the list of environments', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: DeployCommand,
        commandArgs: [environmentName, '--force'],
        api: [
          () => getProjectByEnv(),
          () => getEnvironmentListValid(projectId),
          () => deployValid(),
        ],
        std: [
          inOutDeploySuccessMessage(environmentName),
        ],
      }));
    });

    describe('when answer no on confirm', () => {
      const projectId = 82;
      const environmentName = 'name1';
      it('should not push branch', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: DeployCommand,
        commandArgs: [environmentName],
        api: [
          () => getProjectByEnv(),
          () => getEnvironmentListValid(projectId),
        ],
        promptCounts: [1],
        std: [
          { in: 'n' },
          ...enter,
          { out: `? Deploy ${environmentName} layout changes to reference? No` },
        ],
      }));
    });

    describe('when environment doesn\'t exist', () => {
      const projectId = 82;
      it('should throw an error', () => testCli({
        env: testEnv2,
        token: 'any',
        commandClass: DeployCommand,
        commandArgs: ['notExist'],
        api: [
          () => getProjectByEnv(),
          () => getEnvironmentListValid(projectId),
        ],
        exitCode: 2,
        exitMessage: "❌ The environment provided doesn't exist.",
      }));
    });
  });
});
