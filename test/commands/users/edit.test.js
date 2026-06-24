const nock = require('nock');
const testCli = require('../test-cli-helper/test-cli');
const UsersEditCommand = require('../../../src/commands/users/edit').default;

const { testEnvWithoutSecret } = require('../../fixtures/env');

const OPERATIONS = { id: '7', type: 'teams', attributes: { name: 'Operations' } };
const TECH = { id: '9', type: 'teams', attributes: { name: 'Tech' } };

// alice (id 1): role Admin (id 3), permission editor, team(s) as provided (default: Operations).
function getUserForEdit(teams = [OPERATIONS]) {
  return nock('http://localhost:3001')
    .get('/api/projects/2/users')
    .reply(200, {
      data: [
        {
          type: 'users',
          id: '1',
          attributes: {
            email: 'alice@company.com',
            first_name: 'Alice',
            last_name: 'Smith',
            permission_level: 'editor',
          },
        },
      ],
    })
    .get('/api/users/1/teams')
    .reply(200, { data: teams })
    .get('/api/users')
    .query({ projectId: '2', id: '1', include: 'role' })
    .reply(200, {
      data: { id: '1', type: 'users' },
      included: [{ id: '3', type: 'roles', attributes: { name: 'Admin' } }],
    });
}

const roles = scope =>
  scope
    .get('/api/projects/2/roles')
    .reply(200, { data: [{ type: 'roles', id: '3', attributes: { name: 'Admin' } }] });

const teamsList = scope =>
  scope.get('/api/projects/2/teams').reply(200, { data: [OPERATIONS, TECH] });

describe('users:edit', () => {
  describe('with --permission-level', () => {
    it('updates the level and preserves the current role (id sent as integer)', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-l', 'admin'],
        api: [
          () =>
            getUserForEdit()
              .put(
                '/api/users/1',
                body =>
                  body.data.id === 1 &&
                  body.data.attributes.permission_level === 'admin' &&
                  body.data.relationships.role.data.id === 3 &&
                  body.data.relationships.teams === undefined,
              )
              .reply(200, {}),
        ],
        std: [{ out: 'User "alice@company.com" updated on project 2.' }],
        assertNoStdError: false,
      }));
  });

  describe('with --role', () => {
    it('resolves the role and preserves the current permission level', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-r', 'Admin'],
        api: [
          () =>
            roles(getUserForEdit())
              .put(
                '/api/users/1',
                body =>
                  body.data.attributes.permission_level === 'editor' &&
                  body.data.relationships.role.data.id === 3,
              )
              .reply(200, {}),
        ],
        std: [{ out: 'User "alice@company.com" updated on project 2.' }],
        assertNoStdError: false,
      }));
  });

  describe('with --team (no team removed)', () => {
    it('sends the team set and preserves role + level', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-t', 'Operations'],
        api: [
          () =>
            teamsList(getUserForEdit())
              .put(
                '/api/users/1',
                body =>
                  body.data.relationships.teams.data.length === 1 &&
                  body.data.relationships.teams.data[0].id === 7 &&
                  body.data.relationships.role.data.id === 3,
              )
              .reply(200, {}),
        ],
        std: [{ out: 'User "alice@company.com" updated on project 2.' }],
        assertNoStdError: false,
      }));
  });

  describe('with multiple --team', () => {
    it('sends the full team set', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-t', 'Operations', '-t', 'Tech'],
        api: [
          () =>
            teamsList(getUserForEdit())
              .put('/api/users/1', body => body.data.relationships.teams.data.length === 2)
              .reply(200, {}),
        ],
        std: [{ out: 'User "alice@company.com" updated on project 2.' }],
        assertNoStdError: false,
      }));
  });

  describe('when --team would remove other teams', () => {
    it('asks for confirmation and proceeds when accepted', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-t', 'Operations'],
        api: [
          () =>
            teamsList(getUserForEdit([OPERATIONS, TECH]))
              .put('/api/users/1', body => body.data.relationships.teams.data.length === 1)
              .reply(200, {}),
        ],
        prompts: [
          {
            in: [
              {
                message: 'This will remove alice@company.com from team(s): Tech. Continue?',
                name: 'confirm',
                type: 'confirm',
              },
            ],
            out: { confirm: true },
          },
        ],
        std: [{ out: 'User "alice@company.com" updated on project 2.' }],
        assertNoStdError: false,
      }));

    it('aborts without any PUT when declined', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-t', 'Operations'],
        // No .put interceptor: the command must not write when the user declines.
        api: [() => teamsList(getUserForEdit([OPERATIONS, TECH]))],
        prompts: [
          {
            in: [
              {
                message: 'This will remove alice@company.com from team(s): Tech. Continue?',
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

    it('skips the confirmation with --force', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-t', 'Operations', '-f'],
        api: [
          () =>
            teamsList(getUserForEdit([OPERATIONS, TECH]))
              .put('/api/users/1', body => body.data.relationships.teams.data.length === 1)
              .reply(200, {}),
        ],
        std: [{ out: 'User "alice@company.com" updated on project 2.' }],
        assertNoStdError: false,
      }));
  });

  describe('with no flags', () => {
    it('errors and exits 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com'],
        api: [],
        std: [{ err: 'At least one of --role, --team or --permission-level is required.' }],
        exitCode: 1,
      }));
  });

  describe('with an unknown user email', () => {
    it('errors and exits 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'unknown@company.com', '-l', 'admin'],
        // No match → findByEmail returns after the list, without enriching teams/role.
        api: [
          () =>
            nock('http://localhost:3001')
              .get('/api/projects/2/users')
              .reply(200, {
                data: [{ type: 'users', id: '1', attributes: { email: 'alice@company.com' } }],
              }),
        ],
        std: [{ err: '× User "unknown@company.com" not found in this project.' }],
        exitCode: 1,
      }));
  });

  describe('with an unknown role name', () => {
    it('errors and lists available roles', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-r', 'Nope'],
        api: [() => roles(getUserForEdit())],
        std: [{ err: '× Role "Nope" not found. Available: Admin.' }],
        exitCode: 1,
      }));
  });

  describe('when the server rejects the edit', () => {
    it('prints the API error detail and exits 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: UsersEditCommand,
        commandArgs: ['-p', '2', '-e', 'alice@company.com', '-r', 'Admin'],
        api: [
          () =>
            roles(getUserForEdit())
              .put('/api/users/1')
              .reply(422, { errors: [{ detail: 'Role does not belong to this project.' }] }),
        ],
        std: [{ err: 'Role does not belong to this project.' }],
        exitCode: 1,
      }));
  });
});
