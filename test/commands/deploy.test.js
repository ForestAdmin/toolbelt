const testCli = require('./test-cli-helper/test-cli');
const DeployCommand = require('../../src/commands/deploy');
const {
  getDevelopmentEnvironmentValid,
  getProjectByEnv,
  getProjectListValid,
  deployValid,
} = require('../fixtures/api');
const { testEnvWithoutSecret, testEnvWithSecret } = require('../fixtures/env');

describe('deploy', () => {
  describe('when the user is logged in', () => {
    describe('when no project was provided', () => {
      const validEnvSecret = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
      it('should display the list of projects', () => testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: DeployCommand,
        api: [
          () => getProjectListValid(),
          () => getDevelopmentEnvironmentValid(1),
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
              name: 'confirm',
              message: 'Deploy layout changes to reference?',
              type: 'confirm',
            }],
            out: {
              confirm: true,
            },
          },
        ],
        std: [
          { out: '√ Deployed layout changes to reference environment.' },
        ],
      }));
    });

    describe('when project was provided', () => {
      describe('using command line', () => {
        it('should not display the list of projects', () => testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: DeployCommand,
          commandArgs: ['-p', '82'],
          api: [
            () => deployValid(),
          ],
          prompts: [
            {
              in: [{
                name: 'confirm',
                message: 'Deploy layout changes to reference?',
                type: 'confirm',
              }],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            { out: '√ Deployed layout changes to reference environment.' },
          ],
        }));
      });

      describe('guessed from FOREST_ENV_SECRET', () => {
        it('should not display the list of projects', () => testCli({
          env: testEnvWithSecret,
          token: 'any',
          commandClass: DeployCommand,
          api: [
            () => getProjectByEnv(),
            () => deployValid(),
          ],
          prompts: [
            {
              in: [{
                name: 'confirm',
                message: 'Deploy layout changes to reference?',
                type: 'confirm',
              }],
              out: {
                confirm: true,
              },
            },
          ],
          std: [
            { out: '√ Deployed layout changes to reference environment.' },
          ],
        }));
      });
    });

    describe('when force option was provided', () => {
      it('should not ask for confirm', () => testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: DeployCommand,
        commandArgs: ['--force'],
        api: [
          () => getProjectByEnv(),
          () => deployValid(),
        ],
        std: [
          { out: '√ Deployed layout changes to reference environment.' },
        ],
      }));
    });

    describe('when answer no on confirm', () => {
      it('should not push branch', () => testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: DeployCommand,
        commandArgs: [],
        api: [
          () => getProjectByEnv(),
        ],
        prompts: [
          {
            in: [{
              name: 'confirm',
              message: 'Deploy layout changes to reference?',
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
  });
});
