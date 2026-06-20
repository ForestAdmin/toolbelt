const testCli = require('../test-cli-helper/test-cli');
const RolesApplyCommand = require('../../../src/commands/roles/apply').default;
const {
  getEnvironmentListValid,
  getRolesValid,
  getRoleByIdValid,
  patchPermissionsValid,
} = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

// A minimal wide CSV that matches exactly the current state (no changes).
// We apply to `name2` (env id 4). The getRoleByIdValid fixture only carries
// permissions for env id 3 (name1), so for env 4 the current state is empty
// (all false) and the diff is clean.
const NO_CHANGE_CSV = `role,enabled,orders:browse,orders:read,orders:add,orders:edit,orders:delete,orders:export,orders:Mark as shipped:trigger,orders:Mark as shipped:approvalRequired,orders:Mark as shipped:userApproval,orders:Mark as shipped:selfApproval,orders:Mark as shipped:hasConditions
Admin,false,false,false,false,false,false,false,false,false,false,false,false
`;

// A CSV that sets browseEnabled true for the Admin role.
const CHANGE_CSV = `role,enabled,orders:browse,orders:read,orders:add,orders:edit,orders:delete,orders:export,orders:Mark as shipped:trigger,orders:Mark as shipped:approvalRequired,orders:Mark as shipped:userApproval,orders:Mark as shipped:selfApproval,orders:Mark as shipped:hasConditions
Admin,false,true,false,false,false,false,false,false,false,false,false,false
`;

describe('roles:apply', () => {
  describe('when the CSV matches the current state', () => {
    it('should report nothing to apply', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'name2', '-p', '2', '--force', 'roles.csv'],
        files: [{ name: 'roles.csv', content: NO_CHANGE_CSV }],
        api: [
          () => getEnvironmentListValid(),
          () => getRolesValid(),
          () => getRoleByIdValid('3', 2),
          () => getRoleByIdValid('4', 2),
        ],
        std: [{ out: 'Role Admin: 0 change(s)' }, { out: 'Nothing to apply.' }],
      }));
  });

  describe('when the CSV differs from the current state', () => {
    it('should patch permissions with --force', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'name2', '-p', '2', '--force', 'roles.csv'],
        files: [{ name: 'roles.csv', content: CHANGE_CSV }],
        api: [
          () => getEnvironmentListValid(),
          () => getRolesValid(),
          () => getRoleByIdValid('3', 2),
          () => getRoleByIdValid('4', 2),
          () => patchPermissionsValid('3', 2),
        ],
        std: [{ out: 'Role Admin: 1 change(s)' }, { out: 'Applied changes to 1 role(s).' }],
      }));
  });

  describe('with an unknown environment name', () => {
    it('should error and list available environments', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'nonexistent', '-p', '2', '--force', 'roles.csv'],
        files: [{ name: 'roles.csv', content: NO_CHANGE_CSV }],
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
