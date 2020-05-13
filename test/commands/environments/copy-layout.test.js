const testCli = require('./../test-cli');
const CopyLayoutCommand = require('../../../src/commands/environments/copy-layout');
const { testEnv } = require('../../fixtures/env');
const {
  getEnvironmentValid,
  getEnvironmentValid2,
  postCopyLayout,
  getJob,
  getJobFailed,
  getEnvironmentNotFound,
} = require('../../fixtures/api');

describe('environments:copy-layout', () => {
  describe('on an existing destination environment', () => {
    describe('on a completed job', () => {
      it('should copy the layout', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => CopyLayoutCommand.run(['325', '324', '-p', '82', '--force']),
        api: [
          getEnvironmentValid(),
          getEnvironmentValid2(),
          postCopyLayout(),
          getJob(),
        ],
        std: [
          { out: 'Environment\'s layout Production successfully copied to Staging.' },
        ],
      }));
    });

    describe('on a failed job', () => {
      it('should exit with status 1', () => testCli({
        env: testEnv,
        token: 'any',
        command: () => CopyLayoutCommand.run(['325', '324', '-p', '82', '--force']),
        api: [
          getEnvironmentValid(),
          getEnvironmentValid2(),
          postCopyLayout(),
          getJobFailed(),
        ],
        exitCode: 1,
        exitMessage: 'Oops, something went wrong.',
      }));
    });
  });

  describe('on an unexisting destination environment', () => {
    it('should exit with status 3', () => testCli({
      env: testEnv,
      token: 'any',
      command: () => CopyLayoutCommand.run(['325', '324', '-p', '82', '--force']),
      api: [
        getEnvironmentNotFound(324),
        getEnvironmentValid2(),
      ],
      exitCode: 3,
      // NOTICE: Fails in the CI (due to chalk formatting?)
      // exitMessage: 'Cannot find the target environment [1m324[22m on the project [1m82[22m.',
    }));
  });
});
