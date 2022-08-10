const testCli = require('./test-cli-helper/test-cli');
const SetOriginCommand = require('../../src/commands/set-origin');
const {
  getProjectListValid,
  getDevelopmentEnvironmentValid,
  getEnvironmentListValid,
  setOriginValid,
  setOriginInValid,
  getProjectByEnv,
  getEnvironmentListValid2,
} = require('../fixtures/api');
const { testEnvWithoutSecret, testEnvWithSecret } = require('../fixtures/env');

describe('set origin', () => {
  describe('when no project was provided', () => {
    const secretKey = '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125';
    it('should display the list of projects', () => testCli({
      env: testEnvWithoutSecret,
      token: 'any',
      commandClass: SetOriginCommand,
      api: [
        () => getProjectListValid(),
        () => getDevelopmentEnvironmentValid(),
        () => getEnvironmentListValid(1),
        () => setOriginValid('name1', secretKey),
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
            message: 'Select the environment you want to set as origin',
            type: 'list',
            choices: ['name1', 'name2'],
          }],
          out: {
            environment: 'name1',
          },
        },
      ],
      std: [
        { out: '√ Origin "name1" successfully set.' },
      ],
    }));
  });

  describe('when no argument was provided', () => {
    it('should display the list of available environments', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: SetOriginCommand,
      api: [
        () => getProjectByEnv(),
        () => getEnvironmentListValid2(),
        () => setOriginValid('Production'),
      ],
      prompts: [
        {
          in: [{
            name: 'environment',
            message: 'Select the environment you want to set as origin',
            type: 'list',
            choices: ['Production'],
          }],
          out: {
            environment: 'Production',
          },
        },
      ],
      std: [
        { out: '√ Origin "Production" successfully set.' },
      ],
    }));
  });

  describe('when argument environment was provided', () => {
    it('should work as expected', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: SetOriginCommand,
      commandArgs: ['Production'],
      api: [
        () => getProjectByEnv(),
        () => setOriginValid('Production'),
      ],
      prompts: [],
      std: [
        { out: '√ Origin "Production" successfully set.' },
      ],
    }));
  });

  describe('when backend throw an error', () => {
    it('should prompt the error', () => testCli({
      env: testEnvWithSecret,
      token: 'any',
      commandClass: SetOriginCommand,
      commandArgs: ['unknownEnv'],
      api: [
        () => getProjectByEnv(),
        () => setOriginInValid('unknownEnv'),
      ],
      prompts: [],
      std: [
        { err: '× Set origin error' },
      ],
      exitCode: 2,
    }));
  });
});
