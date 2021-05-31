const testCli = require('./test-cli');
const EnvironmentCommand = require('../../src/commands/environments');
const {
  loginRequired,
  enter,
  arrowDown,
} = require('../fixtures/std');
const { testEnv } = require('../fixtures/env');
const {
  getProjectListValid,
  getEnvironmentListValid,
  loginValidOidc,
} = require('../fixtures/api');

describe('environments', () => {
  it('should display environment list', () => testCli({
    env: testEnv,
    commandClass: EnvironmentCommand,
    api: [
      loginValidOidc(),
      getProjectListValid(),
      getEnvironmentListValid(),
    ],
    std: [
      ...loginRequired,
      { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check\nYour confirmation code: USER-CODE' },
      ...arrowDown,
      ...enter,
      { out: 'ENVIRONMENTS' },
      { out: 'ID        NAME                URL                                TYPE' },
      { out: '3         name1               http://localhost:1                 remote' },
      { out: '4         name2               http://localhost:2                 production' },
    ],
  }));
});
