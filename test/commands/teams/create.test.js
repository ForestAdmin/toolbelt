const testCli = require('../test-cli-helper/test-cli');
const TeamsCreateCommand = require('../../../src/commands/teams/create').default;
const { createTeamValid, createTeamConflict, getProjectListValid } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

describe('teams:create', () => {
  describe('with a valid team name', () => {
    it('should create the team and print a confirmation', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCreateCommand,
        commandArgs: ['-p', '2', '-n', 'Support'],
        api: [() => createTeamValid()],
        std: [{ out: 'Team "Support" created (id: 12).' }],
        // punycode DEP0040 leaks to stderr on the first command test of a run.
        assertNoStdError: false,
      }));
  });

  describe('with no projectId and multiple projects', () => {
    it('should prompt for the project then create the team there', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCreateCommand,
        commandArgs: ['-n', 'Support'],
        api: [() => getProjectListValid(), () => createTeamValid()],
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
        std: [{ out: 'Team "Support" created (id: 12).' }],
        assertNoStdError: false,
      }));
  });

  describe('when the name is already taken', () => {
    it('should show the server error and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCreateCommand,
        commandArgs: ['-p', '2', '-n', 'Support'],
        api: [() => createTeamConflict()],
        std: [{ err: '× Name has already been taken.' }],
        exitCode: 1,
      }));
  });
});
