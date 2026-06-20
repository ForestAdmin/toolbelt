const testCli = require('../test-cli-helper/test-cli');
const UsersListCommand = require('../../../src/commands/users/list').default;

const { getUsersValid, getUsersEmpty } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

describe('users:list', () => {
  describe('with users in the project', () => {
    it('should display users in a table', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: ['-p', '2'],
        api: [() => getUsersValid()],
        std: [
          { out: 'USERS' },
          { out: 'alice@company.com' },
          { out: 'Alice Smith' },
          { out: 'editor' },
          { out: 'Admin' },
          { out: 'Operations' },
          { out: 'bob@company.com' },
        ],
      }));
  });

  describe('with --format json', () => {
    it('should print the raw user list as JSON', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: ['-p', '2', '-f', 'json'],
        api: [() => getUsersValid()],
        std: [
          { out: '"email": "alice@company.com"' },
          { out: '"permissionLevel": "editor"' },
          { out: '"role": "Admin"' },
          { out: '"teams": [' },
        ],
      }));
  });

  describe('with no users in the project', () => {
    it('should display an empty table', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: ['-p', '2'],
        api: [() => getUsersEmpty()],
        std: [{ out: 'USERS' }],
      }));
  });
});
