const testCli = require('./test-cli');
const BranchCommand = require('../../src/commands/branch');
const {
  getBranchListValid,
} = require('../fixtures/api');
const { testEnv2 } = require('../fixtures/env');

describe('branch', () => {
  describe('with a logged in user', () => {
    it('should display a list of branches', () => testCli({
      env: testEnv2,
      token: 'any',
      command: () => BranchCommand.run([]),
      api: [getBranchListValid()],
      std: [
        { out: 'feature/first' },
        { out: 'feature/second < current branch' },
        { out: 'feature/third' },
      ],
    }));
  });
});
