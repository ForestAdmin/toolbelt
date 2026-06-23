const testCli = require('../test-cli-helper/test-cli');
const UsersListCommand = require('../../../src/commands/users/list').default;

const {
  getUsersValid,
  getUsersEmpty,
  getUsersListError,
  getUsersOneTeamFails,
  getUsersEdgeCases,
  getProjectListValid,
} = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

// Cases that don't assert on stderr set assertNoStdError:false: the first command
// test in a run absorbs Node's `punycode` DEP0040 warning into captured stderr.

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
        assertNoStdError: false,
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
        assertNoStdError: false,
      }));
  });

  describe('with no users in the project', () => {
    it('should print an empty list', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: ['-p', '2', '-f', 'json'],
        api: [() => getUsersEmpty()],
        std: [{ out: '[]' }],
        assertNoStdError: false,
      }));
  });

  describe('when the server rejects the list call', () => {
    it('should print the API error detail and exit 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: ['-p', '2'],
        api: [() => getUsersListError()],
        std: [{ err: 'Project is misconfigured.' }],
        exitCode: 1,
      }));
  });

  describe("when one user's teams sub-call fails", () => {
    it('should degrade that row instead of failing the whole listing', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: ['-p', '2'],
        api: [() => getUsersOneTeamFails()],
        std: [
          { out: 'alice@company.com' },
          { out: 'bob@company.com' },
          { out: 'Could not fetch teams for user 2' },
        ],
        assertNoStdError: false,
      }));
  });

  describe('with a partial user (no last name, no role, multiple teams)', () => {
    it('should map name/role/teams defensively', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: ['-p', '2', '-f', 'json'],
        api: [() => getUsersEdgeCases()],
        std: [
          { out: '"name": "Carol"' },
          { out: '"role": null' },
          { out: '"teams": [' },
          { out: 'Operations' },
          { out: 'Support' },
        ],
        assertNoStdError: false,
      }));
  });

  describe('with no projectId and multiple projects', () => {
    it('should prompt for the project then list its users', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersListCommand,
        commandArgs: [],
        api: [() => getProjectListValid(), () => getUsersValid()],
        prompts: [
          {
            in: [
              {
                name: 'project',
                message: 'Select your project',
                type: 'list',
                choices: [
                  { name: 'project1', value: 1 },
                  { name: 'project2', value: 2 },
                ],
              },
            ],
            out: { project: 2 },
          },
        ],
        std: [{ out: 'alice@company.com' }],
        assertNoStdError: false,
      }));
  });
});
