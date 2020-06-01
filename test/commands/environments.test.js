const testCli = require('./test-cli');
const EnvironmentCommand = require('../../src/commands/environments');
const {
  loginRequired,
  loginPasswordDialog,
  enter,
  arrowDown,
} = require('../fixtures/std');
const { testEnv } = require('../fixtures/env');
const {
  notAGoogleAccount,
  loginValid,
  getProjectListValid,
  getEnvironmentListValid,
} = require('../fixtures/api');

describe('environments', () => {
  it('should display environment list', () => testCli({
    env: testEnv,
    command: () => EnvironmentCommand.run([]),
    api: [
      notAGoogleAccount(),
      loginValid(),
      getProjectListValid(),
      getEnvironmentListValid(),
    ],
    std: [
      ...loginRequired,
      ...loginPasswordDialog,
      ...arrowDown,
      ...enter,
      { out: 'ENVIRONMENTS' },
      { out: 'ID        NAME                URL                                TYPE' },
      { out: '3         name1               http://localhost:1                 remote' },
      { out: '4         name2               http://localhost:2                 production' },
    ],
  }));
});
