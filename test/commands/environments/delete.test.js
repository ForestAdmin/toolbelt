const { testEnvWithoutSecret } = require('../../fixtures/env');
const {
  getEnvironmentNotFound,
  getEnvironmentValid,
  deleteEnvironment,
  deleteEnvironmentFailure,
} = require('../../fixtures/api');
const testCli = require('../test-cli-helper/test-cli');
const DeleteCommand = require('../../../src/commands/environments/delete');

describe('environments:delete', () => {
  describe('on an existing environment', () => {
    describe('on a succcesful removal', () => {
      it('should display environment deleted', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: DeleteCommand,
          commandArgs: ['324', '--force'],
          api: [() => getEnvironmentValid(), () => deleteEnvironment()],
          std: [{ out: 'Environment Staging successfully deleted.' }],
        }));
    });

    describe('on a failed removal', () => {
      it('should exit with status 1', () =>
        testCli({
          env: testEnvWithoutSecret,
          token: 'any',
          commandClass: DeleteCommand,
          commandArgs: ['324', '--force'],
          api: [() => getEnvironmentValid(), () => deleteEnvironmentFailure()],
          std: [{ err: '× Oops, something went wrong.' }],
          exitCode: 1,
        }));
    });
  });

  describe('on an unexisting environment', () => {
    it('exit with status 1', () =>
      testCli({
        token: 'any',
        env: testEnvWithoutSecret,
        api: [() => getEnvironmentNotFound()],
        std: [{ err: '× Cannot find the environment 3947.' }],
        commandClass: DeleteCommand,
        commandArgs: ['3947', '--force'],
        exitCode: 1,
      }));
  });
});
