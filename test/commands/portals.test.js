const PortalsCommand = require('../../src/commands/portals').default;
const testCli = require('./test-cli-helper/test-cli');

describe('portals', () => {
  it('outside a project folder, says so and starts nothing', async () => {
    expect.hasAssertions();

    await testCli({
      commandClass: PortalsCommand,
      commandArgs: ['--dry-run'],
      std: [{ out: 'partner portals' }, { out: 'Demo project · no Forest project here' }],
    });
  });

  it('refuses to run on Windows', async () => {
    expect.hasAssertions();
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      await testCli({
        commandClass: PortalsCommand,
        commandArgs: [],
        exitMessage: '`forest portals` does not run on Windows yet. Use WSL.',
      });
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }
  });
});
