const McpCommand = require('../../src/commands/mcp').default;
const testCli = require('./test-cli-helper/test-cli');

describe('mcp', () => {
  it('outside a project folder, says so and starts nothing', async () => {
    expect.hasAssertions();

    await testCli({
      commandClass: McpCommand,
      commandArgs: ['--dry-run'],
      std: [{ out: 'Forest MCP: Claude on your project' }, { out: 'No Forest project here.' }],
    });
  });

  it('refuses to run on Windows', async () => {
    expect.hasAssertions();
    const platform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      await testCli({
        commandClass: McpCommand,
        commandArgs: [],
        exitMessage: '`forest mcp` does not run on Windows yet. Use WSL.',
      });
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }
  });
});
