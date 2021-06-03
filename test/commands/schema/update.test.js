const testCli = require('../test-cli');
const UpdateCommand = require('../../../src/commands/schema/update');

const {
  loginValidOidc,
} = require('../../fixtures/api');
const { testEnv2 } = require('../../fixtures/env');

describe('schema:update', () => {
  describe('login', () => {
    describe('when the user is not logged in', () => {
      it.skip('should login the user and then send the schema', () => testCli({
        commandClass: UpdateCommand,
        env: testEnv2,
        api: [
          () => loginValidOidc(),
        ],
        files: [{
          name: 'package.json',
          content: 'forest-express-7.0.0',
        }, {
          directory: 'forest',
        }, {
          directory: 'models',
        }, {
          directory: 'routes',
        }],
        std: [
          { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check\nYour confirmation code: USER-CODE' },
        ],
      }));
    });
  });
});
