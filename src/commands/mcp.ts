import { Flags } from '@oclif/core';
import { execFileSync } from 'child_process';

import AbstractCommand from '../abstract-command';
import { MCP_PORT, runMcp } from '../services/onboarding/mcp';

/** Puts text on the macOS clipboard. Quietly skipped elsewhere: the address is on screen anyway. */
function copyToClipboard(text: string): void {
  if (process.platform !== 'darwin') return;

  try {
    execFileSync('pbcopy', { input: text });
  } catch {
    // No clipboard: the address is on screen anyway.
  }
}

export default class McpCommand extends AbstractCommand {
  static override description =
    "Connect Claude to the project in this folder: Forest's MCP server in front of its running " +
    'agent, reachable from claude.ai through a Cloudflare quick tunnel. Ctrl+C stops both. ' +
    'Needs cloudflared and Node 22.12 or later.';

  static override flags = {
    'dry-run': Flags.boolean({
      description: 'Check the project and show what would start, without starting anything.',
      default: false,
    }),
    port: Flags.integer({
      description: "Port of Forest's MCP server on this machine.",
      default: MCP_PORT,
      min: 1,
      max: 65535,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(McpCommand);
    const dryRun = flags['dry-run'];
    const say = (text: string) => this.logger.log(text);

    // Its two processes are stopped by process group, which Windows does not have.
    if (process.platform === 'win32') {
      throw new Error('`forest mcp` does not run on Windows yet. Use WSL.');
    }

    this.logger.log(this.chalk.bold('\n  Forest MCP: Claude on your project\n'));
    await runMcp({
      projectDir: process.cwd(),
      dryRun,
      port: flags.port,
      io: {
        say,
        copy: copyToClipboard,
        // Without a terminal (piped, CI), nobody can press Enter: say it and go on.
        pressEnter: async message => {
          if (dryRun || !process.stdin.isTTY) say(`  ${message}`);
          else await this.context.inquirer.prompt([{ type: 'input', name: 'enter', message }]);
        },
      },
    });
  }
}
