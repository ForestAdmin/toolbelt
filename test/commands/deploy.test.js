const testCli = require('./test-cli-helper/test-cli');
const DeployCommand = require('../../src/commands/deploy');
const {
  getDevelopmentEnvironmentValid,
  getEnvironmentListValid,
  getProjectByEnv,
  getProjectListValid,
  deployValid,
} = require('../fixtures/api');
const { testEnv, testEnv2 } = require('../fixtures/env');

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
          }, {
            in: [{
              name: 'environment',
              message: 'Select the environment containing the layout changes you want to deploy to the reference environment',
              type: 'list',
              choices: ['name1'],
            }],
            out: {
              environment: environmentName,
            },
          }, {
            in: [{
              name: 'confirm',
              message: `Deploy ${environmentName} layout changes to reference?`,
              type: 'confirm',
            }],
            out: {
              confirm: true,
            },
          },
        ],
        std: [
          { out: `√ Deployed ${environmentName} layout changes to reference environment.` },
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
          prompts: [
            {
              in: [{
                name: 'environment',
                message: 'Select the environment containing the layout changes you want to deploy to the reference environment',
                type: 'list',
                choices: ['name1'],
              }],
              out: {
                environment: environmentName,
              },
            }, {
              in: [{
                name: 'confirm',
                message: `Deploy ${environmentName} layout changes to reference?`,
                type: 'confirm',
              }],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            { out: `√ Deployed ${environmentName} layout changes to reference environment.` },
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
          prompts: [
            {
              in: [{
                name: 'environment',
                message: 'Select the environment containing the layout changes you want to deploy to the reference environment',
                type: 'list',
                choices: ['name1'],
              }],
              out: {
                environment: environmentName,
              },
            },
            {
              in: [{
                name: 'confirm',
                message: `Deploy ${environmentName} layout changes to reference?`,
                type: 'confirm',
              }],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            { out: `√ Deployed ${environmentName} layout changes to reference environment.` },
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
        prompts: [
          {
            in: [{
              name: 'confirm',
              message: `Deploy ${environmentName} layout changes to reference?`,
              type: 'confirm',
            }],
            out: {
              confirm: true,
            },
          },
        ],
        std: [
          { out: `√ Deployed ${environmentName} layout changes to reference environment.` },
        ],
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
          { out: `√ Deployed ${environmentName} layout changes to reference environment.` },
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
        prompts: [
          {
            in: [{
              name: 'confirm',
              message: `Deploy ${environmentName} layout changes to reference?`,
              type: 'confirm',
            }],
            out: {
              confirm: false,
            },
          },
        ],
        exitCode: 0,
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
        std: [
          { err: '× The environment provided doesn\'t exist.' },
        ],
        exitCode: 2,
      }));
    });
  });
});
