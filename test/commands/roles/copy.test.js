const testCli = require('../test-cli-helper/test-cli');
const RolesCopyCommand = require('../../../src/commands/roles/copy').default;
const { getEnvironmentListValid, copyPermissionsValid } = require('../../fixtures/api');
const { testEnvWithoutSecret } = require('../../fixtures/env');

describe('roles:copy', () => {
  describe('with valid source and destination environment names', () => {
    it('should copy permissions and print a confirmation', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesCopyCommand,
        commandArgs: ['-p', '2', '-f', 'name1', '-t', 'name2'],
        api: [() => getEnvironmentListValid(), () => copyPermissionsValid()],
        std: [{ out: 'Permissions copied from "name1" to "name2".' }],
      }));
  });

  describe('with an unknown source environment', () => {
    it('should error and list available environments', () =>
      testCli({
        env: testEnvWithoutSecret,
        token: 'any',
        commandClass: RolesCopyCommand,
        commandArgs: ['-p', '2', '-f', 'nonexistent', '-t', 'name2'],
        api: [() => getEnvironmentListValid()],
        std: [
          {
            err: '× Environment "nonexistent" not found in this project. Available: name1, name2, test.',
          },
        ],
        exitCode: 1,
      }));
  });
});
