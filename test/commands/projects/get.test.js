const testCli = require('../test-cli-helper/test-cli');
const GetProjectCommand = require('../../../src/commands/projects/get');
const { testEnv } = require('../../fixtures/env');
const { getProjectValid } = require('../../fixtures/api');

describe('projects:get', () => {
  describe('on an existing project', () => {
    describe('without json option', () => {
      it('should display the configuration of the Forest project', () => testCli({
        env: testEnv,
        token: 'any',
        commandClass: GetProjectCommand,
        commandArgs: ['82'],
        api: [() => getProjectValid()],
        std: [
          { out: 'PROJECT' },
          { out: 'id                   82' },
          { out: 'id                   82' },
          { out: 'name                 Forest' },
          { out: 'default environment  production' },
        ],
      }));
    });

    describe('with json option', () => {
      it('should display the configuration of the Forest project in JSON', () => testCli({
        env: testEnv,
        token: 'any',
        commandClass: GetProjectCommand,
        commandArgs: ['82', '--format', 'json'],
        api: [() => getProjectValid()],
        std: [{
          out: {
            id: '82',
            name: 'Forest',
            defaultEnvironment: {
              name: 'Production',
              apiEndpoint: 'https://api.forestadmin.com',
              type: 'production',
              id: '2200',
            },
          },
        }],
      }));
    });
  });
});
