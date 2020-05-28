const { testEnv } = require('../../fixtures/env');
const {
  getEnvironmentNotFound,
  getEnvironmentValid,
  deleteEnvironment,
  getJob,
  getJobFailed,
} = require('../../fixtures/api');
const testCli = require('./../test-cli');
const DeleteCommand = require('../../../src/commands/environments/delete');

describe('environments:delete', () => {
  describe('on an existing environment', () => {
    describe('on a completed job', () => {
      it('should display environment deleted', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => DeleteCommand.run(['324', '--force']),
        api: [
          getEnvironmentValid(),
          deleteEnvironment(),
          getJob(),
        ],
        std: [
          { out: 'Environment Staging successfully deleted.' },
        ],
      }));
    });

    describe('on a failed job', () => {
      it('should exit with status 1', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => DeleteCommand.run(['324', '--force']),
        api: [
          getEnvironmentValid(),
          deleteEnvironment(),
          getJobFailed(),
        ],
        exitCode: 1,
      }));
    });
  });

  describe('on an unexisting environment', () => {
    it('exit with status 1', () => testCli({
      token: 'any',
      env: testEnv,
      api: [
        getEnvironmentNotFound(),
      ],
      std: [{ err: 'Cannot find the environment 3947.' }],
      command: () => DeleteCommand.run(['3947', '--force']),
      exitCode: 1,
    }));
  });
});
