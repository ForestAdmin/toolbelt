const testDialog = require('./../test-cli');
const EnvironmentCreate = require('../../../src/commands/environments/create');
const {
  loginPasswordDialog,
  loginRequired,
} = require('../../fixtures/dialogs');
const {
  notAGoogleAccountNock,
  validAuthNock,
  projectListNock,
  createEnvironmentNock,
} = require('../../fixtures/nocks');
const { testEnv } = require('../../fixtures/envs');
const {
  enter,
  arrowDown,
} = require('../../fixtures/dialogs');

describe('hello', () => {
  it('should create a new env', () => testDialog({
    print: true,
    env: testEnv,
    command: () => EnvironmentCreate.run(['-n', 'Test', '-u', 'https://test.forestadmin.com']),
    nock: [
      notAGoogleAccountNock(),
      validAuthNock(),
      projectListNock(),
      createEnvironmentNock(),
    ],
    dialog: [
      ...loginRequired,
      ...loginPasswordDialog,
      ...arrowDown,
      ...enter,
    ],
  }));
});
