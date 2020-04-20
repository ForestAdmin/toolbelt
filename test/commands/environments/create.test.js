const testCli = require('./../test-cli');
const EnvironmentCreateCommand = require('../../../src/commands/environments/create');
const {
  arrowDown,
  enter,
  loginPasswordDialog,
  loginRequired,
} = require('../../fixtures/std');
const {
  notAGoogleAccount,
  loginValid,
  getProjectListValid,
  createEnvironmentValid,
} = require('../../fixtures/api');
const { testEnv } = require('../../fixtures/env');

describe('environments:create', () => {
  describe('with a logged-in user', () => {
    describe('without JSON format option', () => {
      it('should returns the freshly created environment', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => EnvironmentCreateCommand.run(['-p', '2', '-n', 'Test', '-u', 'https://test.forestadmin.com']),
        api: [
          createEnvironmentValid(),
        ],
        std: [
          { out: 'ENVIRONMENT' },
          { out: 'id' },
          { out: 'name               Test' },
          { out: 'url                https://test.forestadmin.com' },
          { out: 'active' },
          { out: 'type' },
          { out: 'liana' },
          { out: 'version' },
          { out: 'FOREST_ENV_SECRET  2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125' },
        ],
      }));
    });

    describe('with JSON format option', () => {
      it('should returns the freshly created environment in JSON', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => EnvironmentCreateCommand.run(['-p', '2', '-n', 'Test', '-u', 'https://test.forestadmin.com', '--format', 'json']),
        api: [
          createEnvironmentValid(),
        ],
        std: [
          {
            out: {
              name: 'Test',
              apiEndpoint: 'https://test.forestadmin.com',
              secretKey: '2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125',
            },
          },
        ],
      }));
    });
  });

  describe('without a logged-in user', () => {
    it('should returns the freshly created environment', () => testCli({
      env: testEnv,
      command: () => EnvironmentCreateCommand.run(['-n', 'Test', '-u', 'https://test.forestadmin.com']),
      api: [
        notAGoogleAccount(),
        loginValid(),
        getProjectListValid(),
        createEnvironmentValid(),
      ],
      std: [
        ...loginRequired,
        ...loginPasswordDialog,
        ...arrowDown,
        ...enter,
        { out: 'ENVIRONMENT' },
        { out: 'name               Test' },
        { out: 'url                https://test.forestadmin.com' },
        { out: 'FOREST_ENV_SECRET  2c38a1c6bb28e7bea1c943fac1c1c95db5dc1b7bc73bd649a0b113713ee29125' },
      ],
    }));
  });
});
