const testCli = require('../test-cli-helper/test-cli');
const ListProjectCommand = require('../../../src/commands/projects');
const { testEnvWithoutSecret } = require('../../fixtures/env');
const { getProjectDetailledList } = require('../../fixtures/api');

describe('projects', () => {
  describe('without json option', () => {
    it('should return the list of projects', () => testCli({
      env: testEnvWithoutSecret,
      token: 'any',
      commandClass: ListProjectCommand,
      api: [() => getProjectDetailledList()],
      std: [
        { out: 'PROJECTS' },
        { out: 'ID        NAME' },
        { out: '82        Forest' },
        { out: '21        Illustrio' },
      ],
    }));
  });
  describe('with json option', () => {
    it('should return the list of projects in json format', () => testCli({
      env: testEnvWithoutSecret,
      token: 'any',
      commandClass: ListProjectCommand,
      commandArgs: ['--format', 'json'],
      api: [() => getProjectDetailledList()],
      std: [
        {
          out: [{
            id: '82',
            name: 'Forest',
            defaultEnvironment: {
              id: '2200',
              name: 'Production',
              apiEndpoint: 'https://api.forestadmin.com',
              type: 'production',
            },
          }, {
            id: '21',
            name: 'Illustrio',
            defaultEnvironment: {
              id: '39',
              name: 'Production',
              apiEndpoint: 'http://dev.illustrio.com:5001',
              type: 'development',
            },
          }],
        },
      ],
    }));
  });
});
