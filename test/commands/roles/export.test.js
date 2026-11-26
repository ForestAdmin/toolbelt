const testCli = require('../test-cli-helper/test-cli');
const RolesExportCommand = require('../../../src/commands/roles/export').default;
const {
  getEnvironmentListValid,
  getRolesValid,
  getRoleByIdValid,
  getRoleByIdNotFound,
  getTeamsValid,
  getPermissionLabelsValid,
} = require('../../fixtures/api');
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
          { out: 'Admin,true,true,true,false,false,false,true' },
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

  describe('when one role cannot be fetched', () => {
    it('should skip it (HTTP 4xx) and still export the others', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'name1'],
        api: [
          () => getEnvironmentListValid(),
          () => getRolesValid(),
          () => getRoleByIdValid('3', 2),
          () => getRoleByIdNotFound('4', 2),
        ],
        std: [
          { out: 'Admin,true,true,true,false,false,false,true' },
          { out: 'skipped (HTTP 404)' },
          { out: '1 of 2 role(s) could not be exported' },
        ],
        assertNoStdError: false,
      }));
  });

  describe('when no role can be fetched', () => {
    it('should error and exit 1 instead of reporting an empty success', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'name1'],
        api: [
          () => getEnvironmentListValid(),
          () => getRolesValid(),
          () => getRoleByIdNotFound('3', 2),
          () => getRoleByIdNotFound('4', 2),
        ],
        std: [{ err: 'Could not fetch permissions for any of the 2 role(s).' }],
        exitCode: 1,
      }));
  });

  describe('with --team', () => {
    const HEADER =
      'role,enabled,orders:displayName,orders:browse,orders:read,orders:add,orders:edit,orders:delete,orders:export,orders:Mark as shipped:displayName,orders:Mark as shipped:trigger,orders:Mark as shipped:approvalRequired,orders:Mark as shipped:userApproval,orders:Mark as shipped:selfApproval,orders:Mark as shipped:hasConditions';
    const labels = {
      collections: [
        {
          name: 'orders',
          displayName: 'Commandes',
          actions: [{ name: 'Mark as shipped', displayName: 'Marquer expédiée' }],
        },
      ],
    };

    it('should add the display name columns from the team layout', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'name1', '--team', 'Operations'],
        api: [
          () => getEnvironmentListValid(),
          () => getTeamsValid(),
          () => getRolesValid(),
          () => getRoleByIdValid('3', 2),
          () => getRoleByIdValid('4', 2),
          () => getPermissionLabelsValid(3, 7, labels),
        ],
        std: [
          { out: HEADER },
          { out: 'Admin,true,Commandes,true,true,false,false,false,true,Marquer expédiée,true' },
        ],
        assertNoStdError: false,
      }));

    it('should error and list the teams when the team is unknown, before any role fetch', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'name1', '--team', 'nope'],
        api: [() => getEnvironmentListValid(), () => getTeamsValid()],
        std: [{ err: '× Team "nope" not found in this project. Available: Operations, Support.' }],
        exitCode: 1,
      }));

    it('should warn once and fall back to technical names when the team has no layout', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'name1', '--team', 'Support'],
        api: [
          () => getEnvironmentListValid(),
          () => getTeamsValid(),
          () => getRolesValid(),
          () => getRoleByIdValid('3', 2),
          () => getRoleByIdValid('4', 2),
          () => getPermissionLabelsValid(3, 8, { collections: [] }),
        ],
        std: [
          { out: 'Admin,true,orders,true,true,false,false,false,true,Mark as shipped,true' },
          {
            err: 'Δ Team "Support" has no layout on environment "name1": display name columns hold technical names.',
          },
        ],
        assertNoStdError: false,
      }));

    it('should keep stdout to the CSV, warnings going to stderr', async () => {
      expect.hasAssertions();
      const written = [];
      const captureStdout = scope => {
        const original = process.stdout.write;
        process.stdout.write = (chunk, ...rest) => {
          written.push(String(chunk));
          return original.call(process.stdout, chunk, ...rest);
        };
        return scope;
      };

      await testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesExportCommand,
        commandArgs: ['-p', '2', '-e', 'name1', '--team', 'Support'],
        api: [
          () => captureStdout(getEnvironmentListValid()),
          () => getTeamsValid(),
          () => getRolesValid(),
          () => getRoleByIdValid('3', 2),
          () => getRoleByIdNotFound('4', 2),
          () => getPermissionLabelsValid(3, 8, { collections: [] }),
        ],
        std: [
          { out: 'Admin,true' },
          { err: 'skipped (HTTP 404)' },
          { err: 'has no layout on environment "name1"' },
        ],
        assertNoStdError: false,
      });

      expect(written.join('')).toMatch(/^role,enabled,[^\n]*\nAdmin,true,[^\n]*\n$/);
    });
  });
});
