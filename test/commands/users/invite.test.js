const testCli = require('../test-cli-helper/test-cli');
const UsersInviteCommand = require('../../../src/commands/users/invite').default;

const {
  getTeamsValid,
  getRolesValid,
  inviteUsersValid,
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
