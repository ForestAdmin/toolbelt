const testCli = require('../test-cli-helper/test-cli');
const TeamsDeleteCommand = require('../../../src/commands/teams/delete').default;
const {
  getTeamsValid,
  getTeamsEmpty,
  deleteTeamValid,
  deleteTeamError,
} = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

const confirmPrompt = confirm => ({
  in: [
    {
      type: 'confirm',
      name: 'confirm',
      message: 'This will permanently delete team Support on project 2. Continue?',
      default: false,
    },
  ],
  out: { confirm },
});

describe('teams:delete', () => {
  describe('with --force', () => {
    it('should delete the team without prompting and print a confirmation', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsDeleteCommand,
        commandArgs: ['-p', '2', '-n', 'Support', '--force'],
        // '8' is Support's id in getTeamsValid: this asserts the name→id resolution.
        api: [() => getTeamsValid(), () => deleteTeamValid('8')],
        std: [{ out: 'Team "Support" deleted from project 2.' }],
        // punycode DEP0040 leaks to stderr on the first command test of a run.
        assertNoStdError: false,
      }));
  });

  describe('when the user confirms the prompt', () => {
    it('should delete the team', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsDeleteCommand,
        commandArgs: ['-p', '2', '-n', 'Support'],
        api: [() => getTeamsValid(), () => deleteTeamValid('8')],
        prompts: [confirmPrompt(true)],
        std: [{ out: 'Team "Support" deleted from project 2.' }],
      }));
  });

  describe('when the user declines the prompt', () => {
    it('should abort without deleting', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsDeleteCommand,
        commandArgs: ['-p', '2', '-n', 'Support'],
        api: [() => getTeamsValid()],
        prompts: [confirmPrompt(false)],
        std: [{ out: 'Aborted.' }],
      }));
  });

  describe('when the team does not exist', () => {
    it('should error, list available teams and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsDeleteCommand,
        commandArgs: ['-p', '2', '-n', 'Unknown', '--force'],
        api: [() => getTeamsValid()],
        std: [
          {
            err: '× Team "Unknown" not found in this project. Available: Operations, Support.',
          },
        ],
        exitCode: 1,
      }));
  });

  describe('when no team exists in the project', () => {
    it('should report an empty available list and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsDeleteCommand,
        commandArgs: ['-p', '2', '-n', 'Support', '--force'],
        api: [() => getTeamsEmpty()],
        std: [
          {
            err: '× Team "Support" not found in this project. Available: (none).',
          },
        ],
        exitCode: 1,
      }));
  });

  describe('when the server rejects the deletion', () => {
    it('should surface the server error detail and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsDeleteCommand,
        commandArgs: ['-p', '2', '-n', 'Support', '--force'],
        api: [() => getTeamsValid(), () => deleteTeamError('8')],
        std: [{ err: '× Team not found.' }],
        exitCode: 1,
      }));
  });
});
