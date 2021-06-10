const testCli = require('../test-cli-helper/test-cli');
const EnvironmentCommand = require('../../../src/commands/environments');
const { getEnvironmentListValid2 } = require('../../fixtures/api');
const { testEnv } = require('../../fixtures/env');

describe('environments', () => {
  describe('without JSON format option', () => {
    it('should return the list of environments', () => testCli({
      env: testEnv,
      token: 'any',
      api: [
        () => getEnvironmentListValid2(),
      ],
      commandClass: EnvironmentCommand,
      commandArgs: ['-p', '82'],
      std: [
        { out: 'ENVIRONMENTS' },
        { out: 'ID        NAME                URL                                TYPE' },
        { out: '324       Staging             https://forestadmin-server-stagi…  development' },
        { out: '325       Production          https://forestadmin-server.herok…  production' },
      ],
    }));
  });

  describe('with JSON format option', () => {
    it('should return the list of environments in JSON', () => testCli({
      env: testEnv,
      token: 'any',
      api: [
        () => getEnvironmentListValid2(),
      ],
      commandClass: EnvironmentCommand,
      commandArgs: ['-p', '82', '--format', 'json'],
      std: [{
        out: [
          {
            id: '324',
            name: 'Staging',
            apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
            isActive: true,
            type: 'development',
            lianaName: 'forest-express-sequelize',
            lianaVersion: '1.3.2',
            secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
          },
          {
            id: '325',
            name: 'Production',
            apiEndpoint: 'https://forestadmin-server.herokuapp.com',
            isActive: true,
            type: 'production',
            lianaName: 'forest-express-sequelize',
            lianaVersion: '1.3.2',
            secretKey: '1b91a1c9bb28e4bea3c941fac1c1c95db5dc1b7bc73bd649b0b113713ee18167',
          },
        ],
      }],
    }));
  });
});
