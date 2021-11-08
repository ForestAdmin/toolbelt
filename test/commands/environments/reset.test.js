const testCli = require('../test-cli-helper/test-cli');
const ResetCommand = require('../../../src/commands/environments/reset');
const {
  getProjectListValid,
  getDevelopmentEnvironmentValid,
  getEnvironmentListValid,
  resetRemoteEnvironment,
  getProjectByEnv,
} = require('../../fixtures/api');
const { testEnvWithoutSecret, testEnvWithSecret } = require('../../fixtures/env');

describe('environments:reset', () => {
  describe('when logged in', () => {
    describe('with not options', () => {
      it('should return prompt for a list of remote environment, ask confirmation and call reset', () => testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: ResetCommand,
        commandArgs: [],
        api: [
          () => getProjectListValid(),
          () => getDevelopmentEnvironmentValid(),
          () => getEnvironmentListValid(1),
          () => resetRemoteEnvironment(),
        ],
        prompts: [{
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
            message: 'Select the remote environment you want to reset',
            type: 'list',
            choices: ['name1'],
          }],
          out: {
            environment: 'name1',
          },
        }, {
          in: [{
            name: 'confirm',
            message: 'Reset changes on the environment name1',
            type: 'confirm',
          }],
          out: {
            confirm: true,
          },
        }],
        std: [
          { out: 'Environment name1 successfully resetted' },
        ],
      }));
    });

    describe('with -e/--environmentName option', () => {
      it('should ask confirmation and call reset', () => testCli({
        env: testEnvWithSecret,
        token: 'any',
        commandClass: ResetCommand,
        commandArgs: ['-e', 'name1'],
        api: [
          () => getProjectByEnv(),
          () => resetRemoteEnvironment(),
        ],
        prompts: [{
          in: [{
            name: 'confirm',
            message: 'Reset changes on the environment name1',
            type: 'confirm',
          }],
          out: {
            confirm: true,
          },
        }],
        std: [
          { out: 'Environment name1 successfully resetted' },
        ],
      }));
    });
  });

  describe('with -f/--force option', () => {
    it('should ask confirmation and call reset', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: ResetCommand,
      commandArgs: ['-e', 'name1', '--force'],
      api: [
        () => getProjectByEnv(),
        () => resetRemoteEnvironment(),
      ],
      prompts: [],
      std: [
        { out: 'Environment name1 successfully resetted' },
      ],
    }));
  });
});
