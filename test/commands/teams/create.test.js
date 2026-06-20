const testCli = require('../test-cli-helper/test-cli');
const TeamsCreateCommand = require('../../../src/commands/teams/create').default;
const { createTeamValid, createTeamConflict } = require('../../fixtures/api');
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
