const testCli = require('./../test-cli');
const { testEnv } = require('../../fixtures/env');
const { updateEnvironmentName, updateEnvironmentEndpoint } = require('../../fixtures/api');
const UpdateCommand = require('../../../src/commands/environments/update');

describe('environments:update', () => {
  describe('with a valid token, environment id and name', () => {
    it('should display "environment updated"', () => testCli({
      env: testEnv,
      token: 'any',
      command: () => UpdateCommand.run(['-e', '182', '-n', 'NewName']),
      api: [
        updateEnvironmentName(),
      ],
      std: [
        { out: 'Environment updated' },
      ],
    }));
  });

  describe('with a valid token, environment id and apiEnpoint', () => {
    it('should display "environment updated"', () => testCli({
      env: testEnv,
      token: 'any',
      command: () => UpdateCommand.run(['-e', '182', '-u', 'https://super.url.com']),
      api: [
        updateEnvironmentEndpoint(),
      ],
      std: [
        { out: 'Environment updated' },
      ],
    }));
  });

  describe('with a valid token, environment id but neither name nor apiEndpoint', () => {
    it('should display "Please provide environment name and/or url"', () => testCli({
      env: testEnv,
      token: 'any',
      command: () => UpdateCommand.run(['-e', '182']),
      std: [
        { err: 'Please provide environment name and/or url' },
      ],
    }));
  });
});
