const testCli = require('../test-cli-helper/test-cli');
const {
  getEnvironmentValid,
  getEnvironmentNotFound,
} = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');
const GetCommand = require('../../../src/commands/environments/get');

describe('environments:get', () => {
  describe('on an existing environment', () => {
    describe('without JSON format option', () => {
      it('should display the configuration of the Staging environment', () => testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: GetCommand,
        commandArgs: ['324'],
        api: [
          () => getEnvironmentValid(),
        ],
        std: [
          { out: 'id                 324' },
          { out: 'name               Staging' },
          { out: 'url                https://forestadmin-server-staging.herokuapp.com' },
          { out: 'active             true' },
          { out: 'type               development' },
          { out: 'liana              forest-express-sequelize' },
          { out: 'version            1.3.2' },
          { out: 'FOREST_ENV_SECRET  2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125' },
        ],
      }));
    });
    describe('with JSON format option', () => {
      it('should display the configuration of the Staging environment', () => testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: GetCommand,
        commandArgs: ['324', '--format', 'json'],
        api: [
          () => getEnvironmentValid(),
        ],
        std: [
          {
            out: {
              name: 'Staging',
              apiEndpoint: 'https://forestadmin-server-staging.herokuapp.com',
              isActive: true,
              type: 'development',
              lianaName: 'forest-express-sequelize',
              lianaVersion: '1.3.2',
              secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
              id: '324',
            },
          },
        ],
      }));
    });
  });

  describe('on an unknown environment', () => {
    it('should display a NotFound error', () => testCli({
      env: testEnvWithoutSecret,
      token: 'any',
      commandClass: GetCommand,
      commandArgs: ['3947'],
      api: [
        () => getEnvironmentNotFound(),
      ],
      std: [
        { err: '× Cannot find the environment 3947.' },
      ],
    }));
  });
});
