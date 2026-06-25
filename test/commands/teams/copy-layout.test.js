const testCli = require('../test-cli-helper/test-cli');
const TeamsCopyLayoutCommand = require('../../../src/commands/teams/copy-layout').default;
const {
  getTeamsValid,
  postCopyTeamLayout,
  postCopyTeamLayoutNoJob,
  postCopyTeamLayoutError,
  getJob,
  getJobFailed,
} = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

describe('teams:copy-layout', () => {
  describe('on a completed job', () => {
    it('should copy the layout and print a confirmation', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Support', '--force'],
        api: [() => getTeamsValid(), () => postCopyTeamLayout(), () => getJob()],
        assertNoStdError: false,
        std: [{ out: 'Layout of team "Operations" copied to "Support" on project 2.' }],
      }));
  });

  describe('on a failed job', () => {
    it('should exit with status 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Support', '--force'],
        api: [() => getTeamsValid(), () => postCopyTeamLayout(), () => getJobFailed()],
        assertNoStdError: false,
        std: [{ err: '× Oops, something went wrong.' }],
        exitCode: 1,
      }));
  });

  describe('when the user declines the prompt', () => {
    it('should abort without copying', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Support'],
        api: [() => getTeamsValid()],
        prompts: [
          {
            in: [
              {
                type: 'confirm',
                name: 'confirm',
                message:
                  'This will overwrite the whole layout of team Support with the layout of Operations. Continue?',
                default: false,
              },
            ],
            out: { confirm: false },
          },
        ],
        std: [{ out: 'Aborted.' }],
      }));
  });

  describe('when the user confirms the prompt', () => {
    it('should copy the layout', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Support'],
        api: [() => getTeamsValid(), () => postCopyTeamLayout(), () => getJob()],
        prompts: [
          {
            in: [
              {
                type: 'confirm',
                name: 'confirm',
                message:
                  'This will overwrite the whole layout of team Support with the layout of Operations. Continue?',
                default: false,
              },
            ],
            out: { confirm: true },
          },
        ],
        assertNoStdError: false,
        std: [{ out: 'Layout of team "Operations" copied to "Support" on project 2.' }],
      }));
  });

  describe('when the source team does not exist', () => {
    it('should error and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Unknown', '-t', 'Support', '--force'],
        api: [() => getTeamsValid()],
        std: [
          {
            err: '× Source team "Unknown" not found in this project. Available: Operations, Support.',
          },
        ],
        exitCode: 1,
      }));
  });

  describe('when source and target are the same team', () => {
    it('should error and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Operations', '--force'],
        api: [() => getTeamsValid()],
        std: [{ err: '× Source and target teams must be different.' }],
        exitCode: 1,
      }));
  });

  describe('when the target team does not exist', () => {
    it('should error and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Unknown', '--force'],
        api: [() => getTeamsValid()],
        std: [
          {
            err: '× Target team "Unknown" not found in this project. Available: Operations, Support.',
          },
        ],
        exitCode: 1,
      }));
  });

  describe('when the deployment request returns no job', () => {
    it('should report a failure and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Support', '--force'],
        api: [() => getTeamsValid(), () => postCopyTeamLayoutNoJob()],
        assertNoStdError: false,
        std: [{ err: '× Oops, something went wrong.' }],
        exitCode: 1,
      }));
  });

  describe('when the server rejects the deployment request', () => {
    it('should surface the server error detail and exit with code 1', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: TeamsCopyLayoutCommand,
        commandArgs: ['-p', '2', '-f', 'Operations', '-t', 'Support', '--force'],
        api: [() => getTeamsValid(), () => postCopyTeamLayoutError()],
        assertNoStdError: false,
        std: [{ err: '× Source team no longer exists.' }],
        exitCode: 1,
      }));
  });
});
