const testCli = require('./test-cli-helper/test-cli');

const UserCommand = require('../../src/commands/user');

describe('user command', () => {
  describe('when not logged in', () => {
    it('should terminate with code 1', () => testCli({
      commandClass: UserCommand,
      token: null,
      std: [
        { err: 'You are not logged.' },
      ],
      exitCode: 1,
    }));
  });

  describe('when logged in', () => {
    it('should log email', () => testCli({
      commandClass: UserCommand,
      token: { data: { data: { attributes: { email: 'user@test.com' } } } },
      std: [
        { out: '> Email: user@test.com' },
      ],
      exitCode: 0,
    }));
  });
});
