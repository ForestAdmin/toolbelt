const testCli = require('../test-cli-helper/test-cli');
const UsersInviteCommand = require('../../../src/commands/users/invite').default;

const {
  getTeamsValid,
  getRolesValid,
  getRolesEmpty,
  inviteUsersValid,
  inviteUsersMultipleValid,
  inviteUsersDetailedError,
} = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

describe('users:invite', () => {
  describe('with team and role names', () => {
    it('should resolve names to ids, invite the user and confirm', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersInviteCommand,
        commandArgs: [
          '-p',
          '2',
          '-e',
          'new@user.com',
          '-t',
          'Operations',
          '-r',
          'Admin',
          '-l',
          'editor',
        ],
        api: [() => getTeamsValid(), () => getRolesValid(), () => inviteUsersValid()],
        std: [
          {
            out: 'Invited 1 user(s) to team "Operations" (editor) on project 2: new@user.com.',
          },
        ],
      }));
  });

  describe('with an unknown team name', () => {
    it('should error and list the available teams', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersInviteCommand,
        commandArgs: ['-p', '2', '-e', 'new@user.com', '-t', 'Nope', '-r', 'Admin', '-l', 'editor'],
        api: [() => getTeamsValid()],
        std: [{ err: '× team "Nope" not found in this project. Available: Operations, Support.' }],
        exitCode: 1,
      }));
  });

  describe('with several emails', () => {
    it('should send one invitation per email in a single request', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersInviteCommand,
        commandArgs: [
          '-p',
          '2',
          '-e',
          'new@user.com',
          '-e',
          'second@user.com',
          '-t',
          'Operations',
          '-r',
          'Admin',
          '-l',
          'editor',
        ],
        api: [() => getTeamsValid(), () => getRolesValid(), () => inviteUsersMultipleValid()],
        std: [
          {
            out: 'Invited 2 user(s) to team "Operations" (editor) on project 2: new@user.com, second@user.com.',
          },
        ],
      }));
  });

  describe('when the project has no role yet', () => {
    it('should error with an actionable hint and exit 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersInviteCommand,
        commandArgs: ['-p', '2', '-e', 'new@user.com', '-t', 'Operations', '-l', 'editor'],
        api: [() => getTeamsValid(), () => getRolesEmpty()],
        std: [
          {
            err: "No role found in this project. Deploy a production environment first (it creates the project's first role), or create one via the API.",
          },
        ],
        exitCode: 1,
      }));
  });

  describe('with --format json', () => {
    it('should print the raw invitation result', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersInviteCommand,
        commandArgs: [
          '-p',
          '2',
          '-e',
          'new@user.com',
          '-t',
          'Operations',
          '-r',
          'Admin',
          '-l',
          'editor',
          '-f',
          'json',
        ],
        api: [() => getTeamsValid(), () => getRolesValid(), () => inviteUsersValid()],
        std: [{ out: '"data": [' }, { out: '"email": "new@user.com"' }],
      }));
  });

  describe('when the server rejects the invitation', () => {
    it('should display the server error and exit 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersInviteCommand,
        commandArgs: [
          '-p',
          '2',
          '-e',
          'new@user.com',
          '-t',
          'Operations',
          '-r',
          'Admin',
          '-l',
          'editor',
        ],
        api: [() => getTeamsValid(), () => getRolesValid(), () => inviteUsersDetailedError()],
        std: [{ err: '× Role project does not match team project.' }],
        exitCode: 1,
      }));
  });
});
