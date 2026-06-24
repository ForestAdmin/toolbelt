const testCli = require('../test-cli-helper/test-cli');
const RolesCreateCommand = require('../../../src/commands/roles/create').default;
const { createRoleValid, createRoleConflict } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

describe('roles:create', () => {
  describe('with a valid role name', () => {
    it('should create the role and print a confirmation', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesCreateCommand,
        commandArgs: ['-p', '2', '-n', 'Operations'],
        api: [() => createRoleValid()],
        std: [{ out: 'Role "Operations" created (id: 10).' }],
      }));
  });

  describe('when the name is already taken', () => {
    it('should show the server error and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesCreateCommand,
        commandArgs: ['-p', '2', '-n', 'Operations'],
        api: [() => createRoleConflict()],
        std: [{ err: '× Name has already been taken.' }],
        exitCode: 1,
      }));
  });
});
