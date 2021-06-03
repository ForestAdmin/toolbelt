const testCli = require('../test-cli');
const UpdateCommand = require('../../../src/commands/schema/update');

const {
  loginValidOidc,
} = require('../../fixtures/api');
const { testEnv2 } = require('../../fixtures/env');

describe('schema:update', () => {
  describe('login', () => {
    describe('when the user is not logged in', () => {
      it('should login the user and then send the schema', () => testCli({
        commandClass: UpdateCommand,
        env: testEnv2,
        api: [
          () => loginValidOidc(),
        ],
        files: [{
          name: 'package.json',
          content: '{ "dependencies": { "forest-express-sequelize": "7.0.0" } }',
        }, {
          name: 'config/databases.js',
          content: 'module.exports = [];',
        }, {
          directory: 'forest',
        }, {
          directory: 'models',
        }, {
          directory: 'routes',
        }],
        std: [
          { out: 'Click on "Log in" on the browser tab which opened automatically or open this link: http://app.localhost/device/check\nYour confirmation code: USER-CODE' },
          { spinner: '✅ Connecting to your database(s)' },
          { spinner: '✅ Analyzing the database(s)' },
          { spinner: '✅ Generating your files' },
        ],
      }));
    });

    describe('when the user is logged in', () => {
      it('should send the schema', () => testCli({
        commandClass: UpdateCommand,
        env: testEnv2,
        token: 'any',
        api: [],
        files: [{
          name: 'package.json',
          content: '{ "dependencies": { "forest-express-sequelize": "7.0.0" } }',
        }, {
          name: 'config/databases.js',
          content: 'module.exports = [];',
        }, {
          directory: 'forest',
        }, {
          directory: 'models',
        }, {
          directory: 'routes',
        }],
        std: [
          { spinner: '✅ Connecting to your database(s)' },
          { spinner: '✅ Analyzing the database(s)' },
          { spinner: '✅ Generating your files' },
        ],
      }));
    });
  });
});
