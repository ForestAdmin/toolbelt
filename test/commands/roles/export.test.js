const testCli = require('../test-cli-helper/test-cli');
const RolesExportCommand = require('../../../src/commands/roles/export').default;
const { getEnvironmentListValid, getRolesValid, getRoleByIdValid } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

describe('roles:export', () => {
  describe('with a valid environment name', () => {
    it('should print a wide CSV to stdout', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'name1'],
        api: [
          () => getEnvironmentListValid(),
          () => getRolesValid(),
          () => getRoleByIdValid('3', 2),
          () => getRoleByIdValid('4', 2),
        ],
        std: [
          {
            out: 'role,enabled,orders:browse,orders:read,orders:add,orders:edit,orders:delete,orders:export,orders:Mark as shipped:trigger,orders:Mark as shipped:approvalRequired,orders:Mark as shipped:userApproval,orders:Mark as shipped:selfApproval,orders:Mark as shipped:hasConditions',
          },
        ],
        assertNoStdError: false,
      }));
  });

  describe('with an unknown environment name', () => {
    it('should error and list available environments', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'nonexistent'],
        api: [() => getEnvironmentListValid()],
        std: [
          {
            err: '× Environment "nonexistent" not found in this project. Available: name1, name2, test.',
          },
        ],
        exitCode: 1,
      }));
  });
});
