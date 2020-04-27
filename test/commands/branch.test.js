const testCli = require('./test-cli');
const BranchCommand = require('../../src/commands/branch');
const {
  getProjectByEnv,
  getBranchListValid,
  getNoBranchListValid,
} = require('../fixtures/api');
const { testEnv2 } = require('../fixtures/env');

describe('branch', () => {
  describe('with a logged in user', () => {
    describe('when environment have branches', () => {
      it('should display a list of branches', () => testCli({
        env: testEnv2,
        token: 'any',
        command: () => BranchCommand.run([]),
        api: [
          getProjectByEnv(),
          getBranchListValid(),
        ],
        std: [
          { out: 'feature/first' },
          { out: 'feature/second < current branch' },
          { out: 'feature/third' },
        ],
      }));
    });

    describe('when environment does not have branches', () => {
      it('should display a list of branches', () => testCli({
        print: true,
        env: testEnv2,
        token: 'any',
        command: () => BranchCommand.run([]),
        api: [
          getProjectByEnv(),
          getNoBranchListValid(),
        ],
        std: [
          { err: "⚠️ You don't have any branch yet. Use `forest branch <branch_name>` to create one." },
        ],
      }));
    });
  });
});
