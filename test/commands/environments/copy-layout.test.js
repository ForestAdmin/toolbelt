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
        commandClass: CopyLayoutCommand,
        commandArgs: ['325', '324', '-p', '82', '--force'],
        api: [
          getEnvironmentValid(),
          getEnvironmentValid2(),
          postCopyLayout(),
          getJob(),
        ],
        assertNoStdError: false,
        std: [
          { out: 'Environment\'s layout Production successfully copied to Staging.' },
        ],
      }));
    });

    describe('on a failed job', () => {
      it('should exit with status 1', () => testCli({
        env: testEnv,
        token: 'any',
        commandClass: CopyLayoutCommand,
        commandArgs: ['325', '324', '-p', '82', '--force'],
        api: [
          getEnvironmentValid(),
          getEnvironmentValid2(),
          postCopyLayout(),
          getJobFailed(),
        ],
        std: [{ err: 'Oops, something went wrong.' }],
        exitCode: 1,
      }));
    });
  });

  describe('on an unexisting destination environment', () => {
    it('should exit with status 3', () => testCli({
      env: testEnv,
      token: 'any',
      commandClass: CopyLayoutCommand,
      commandArgs: ['325', '324', '-p', '82', '--force'],
      api: [
        getEnvironmentNotFound(324),
        getEnvironmentValid2(),
      ],
      std: [{ err: 'Cannot find the target environment 324 on the project 82' }],
      exitCode: 3,
    }));
  });
});
