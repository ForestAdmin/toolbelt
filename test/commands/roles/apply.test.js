const nock = require('nock');
const testCli = require('../test-cli-helper/test-cli');
const RolesApplyCommand = require('../../../src/commands/roles/apply').default;
const {
  getEnvironmentListValid,
  getRolesValid,
  patchPermissionsValid,
} = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

// Distinct role names (Admin=3, Viewer=4). Permissions live under env 3 (name1),
// so applying to name2 (env 4) sees an empty current state — a clean baseline.
function roleById(id, name) {
  return nock('http://localhost:3001')
    .get(`/api/roles/${id}`)
    .reply(200, {
      data: {
        type: 'roles',
        id,
        attributes: {
          name,
          permissions: {
            environments: [
              {
                environmentId: 3,
                enabled: true,
                collections: [{ collectionName: 'orders', browseEnabled: true, smartActions: [] }],
              },
            ],
          },
        },
      },
    });
}

const HEADER =
  'role,enabled,orders:browse,orders:read,orders:add,orders:edit,orders:delete,orders:export';
const row = (name, browse) => `${name},false,${browse},false,false,false,false,false`;
const NO_CHANGE = `${HEADER}\n${row('Admin', 'false')}\n${row('Viewer', 'false')}\n`;
const CHANGE = `${HEADER}\n${row('Admin', 'true')}\n${row('Viewer', 'false')}\n`;
const UNKNOWN_ROLE = `${HEADER}\n${row('Ghost', 'true')}\n`;

const currentState = () => [
  () => getEnvironmentListValid(),
  () => getRolesValid(),
  () => roleById('3', 'Admin'),
  () => roleById('4', 'Viewer'),
];

describe('roles:apply', () => {
  describe('when the CSV matches the current state', () => {
    it('reports nothing to apply', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'name2', '-p', '2', '--force', 'roles.csv'],
        files: [{ name: 'roles.csv', content: NO_CHANGE }],
        api: currentState(),
        std: [{ out: 'Nothing to apply.' }],
        assertNoStdError: false,
      }));
  });

  describe('when the CSV differs from the current state', () => {
    it('patches the changed role with --force', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'name2', '-p', '2', '--force', 'roles.csv'],
        files: [{ name: 'roles.csv', content: CHANGE }],
        api: [...currentState(), () => patchPermissionsValid('3', 2)],
        std: [{ out: 'Role Admin: 1 change(s)' }, { out: 'Applied changes to 1 role(s).' }],
        assertNoStdError: false,
      }));
  });

  describe('when the CSV references a role that does not exist', () => {
    it('errors and does not create it (use roles:create)', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'name2', '-p', '2', '--force', 'roles.csv'],
        files: [{ name: 'roles.csv', content: UNKNOWN_ROLE }],
        api: currentState(),
        std: [{ err: 'Role(s) not found: Ghost. Create them first with `forest roles:create`.' }],
        exitCode: 1,
      }));
  });

  describe('without --force', () => {
    it('aborts when the confirmation is declined', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'name2', '-p', '2', 'roles.csv'],
        // No patch interceptor: nothing must be written when declined.
        files: [{ name: 'roles.csv', content: CHANGE }],
        api: currentState(),
        prompts: [
          {
            in: [
              {
                message: 'Apply 1 change(s) to environment "name2"?',
                name: 'confirm',
                type: 'confirm',
              },
            ],
            out: { confirm: false },
          },
        ],
        std: [{ out: 'Aborted: no change made.' }],
        assertNoStdError: false,
      }));
  });

  describe('with an unknown environment name', () => {
    it('errors and lists available environments', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesApplyCommand,
        commandArgs: ['--env', 'nonexistent', '-p', '2', '--force', 'roles.csv'],
        files: [{ name: 'roles.csv', content: NO_CHANGE }],
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
