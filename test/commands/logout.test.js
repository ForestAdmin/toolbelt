const testCli = require('./test-cli');
const LogoutCommand = require('../../src/commands/logout');

describe('logout', () => {
  it('should logout successfully', () => testCli({
    command: () => LogoutCommand.run([]),
    std: [
      { out: '> You are logged out.' },
    ],
  }));
});
