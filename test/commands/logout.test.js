const testCli = require('./test-cli-helper/test-cli');
const LogoutCommand = require('../../src/commands/logout');

describe('logout', () => {
  it('should logout successfully', () => testCli({
    commandClass: LogoutCommand,
    std: [
      { out: '> You are logged out.' },
    ],
  }));
});
