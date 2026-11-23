import type { ChildProcess } from 'child_process';

import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { agentAnswers, localAgentUrl, readProjectEnv, untilStopped } from './local-agent';

/**
 * Claude on a project's local agent, through Forest's MCP server: the standalone Forest Gateway
 * (`@forestadmin/gateway`, MCP service only) on :3931, reachable from claude.ai through a
 * Cloudflare quick tunnel. The project's .env goes into the gateway's environment, never on screen.
 */

export const MCP_PORT = 3931;
/** What `@forestadmin/gateway` declares in its `engines`. */
export const GATEWAY_MIN_NODE: [number, number] = [22, 12];
/** Where cloudflared serves its metrics, and the quick tunnel's hostname at /quicktunnel. */
const TUNNEL_METRICS_PORTS = [20241, 20242, 20243, 20244, 20245];
const TUNNEL_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const CLOUDFLARED_DOWNLOADS =
  'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/';

export const EXAMPLE_PROMPTS = [
  'Which KYC cases are past their deadline?',
  'Freeze account <account number> and tell me why it was flagged.',
  'Start the retail onboarding workflow on KYC-<number> and tell me where it waits.',
];

/** What the flow needs from its host: a screen, an Enter key, a clipboard. */
export type McpIO = {
  say(text: string): void;
  pressEnter(message: string): Promise<void>;
  copy(text: string): void;
};

export type McpOptions = {
  projectDir: string;
  io: McpIO;
  dryRun?: boolean;
  /** Where the gateway listens: 3931 unless that port is taken. */
  port?: number;
  /** The running Node's version; a parameter so the check can be tested. */
  nodeVersion?: string;
};

async function status(url: string, ms = 3000): Promise<number> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(ms) })).status;
  } catch {
    return 0;
  }
}

/** The address of a quick tunnel already running on this machine, if any. */
export async function runningTunnel(): Promise<string | null> {
  const found = await Promise.all(
    TUNNEL_METRICS_PORTS.map(async port => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/quicktunnel`, {
          signal: AbortSignal.timeout(1000),
        });
        const { hostname } = (await response.json()) as { hostname?: string };

        return hostname ? `https://${hostname}` : null;
      } catch {
        return null;
      }
    }),
  );

  return found.find(Boolean) ?? null;
}

export function hasCloudflared(): boolean {
  try {
    execFileSync('cloudflared', ['--version'], { stdio: 'ignore' });

    return true;
  } catch {
    return false;
  }
}

export function supportsGateway(nodeVersion: string): boolean {
  const [major, minor] = nodeVersion.split('.').map(Number);
  const [needMajor, needMinor] = GATEWAY_MIN_NODE;

  return major > needMajor || (major === needMajor && minor >= needMinor);
}

async function poll<T>(probe: () => Promise<T | null>, ms: number): Promise<T | null> {
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop -- polling is sequential by nature
    const value = await probe();
    if (value) return value;
    // eslint-disable-next-line no-await-in-loop -- polling is sequential by nature
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });
  }

  return null;
}

/** Its own process group, so that stopping it also stops what `npx` started under it. */
function startDetached(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; log: number },
): ChildProcess {
  return spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', options.log, options.log],
    detached: true,
  });
}

function stopGroup(child: ChildProcess): void {
  if (child.exitCode !== null || !child.pid) return;

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

/** Starts the tunnel, then the gateway behind it. Resolves the tunnel's address, or null. */
async function startBoth(
  options: McpOptions,
  env: Record<string, string>,
  run: { children: ChildProcess[]; logFile: string },
): Promise<string | null> {
  const { io } = options;
  const port = options.port ?? MCP_PORT;
  // The gateway's log can name the project: its user's only, the temp folder is shared on Linux.
  const log = fs.openSync(run.logFile, 'a', 0o600);
  const tunnel = startDetached(
    'cloudflared',
    ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`],
    { cwd: options.projectDir, env: process.env, log },
  );
  run.children.push(tunnel);
  io.say('  Opening a public tunnel to your machine (Cloudflare quick tunnel)…');

  const url = await poll(
    async () => fs.readFileSync(run.logFile, 'utf8').match(TUNNEL_URL)?.[0] ?? null,
    30000,
  );

  if (!url) {
    io.say(`  The tunnel didn't give an address. Its log: ${run.logFile}`);

    return null;
  }

  io.say('  Starting the Forest MCP server (the first time, npx downloads it: about 30 s)…');
  run.children.push(
    startDetached('npx', ['-y', '@forestadmin/gateway'], {
      cwd: options.projectDir,
      env: {
        ...process.env,
        ...env,
        FOREST_GATEWAY_SERVICES: 'mcp',
        FOREST_GATEWAY_URL: url,
        FOREST_AGENT_URL: localAgentUrl(env),
        PORT: String(port),
      },
      log,
    }),
  );

  return url;
}

/** The claude.ai side, one step at a time. */
async function guide(url: string, { io }: McpOptions): Promise<void> {
  const mcpUrl = `${url}/mcp`;

  io.copy(mcpUrl);
  io.say(`\n  Your project's MCP server: ${mcpUrl}  (copied to the clipboard)`);
  io.say(
    '  A quick tunnel gets a new address each time it starts: add the connector again then.\n',
  );
  io.say('  Step 1. In claude.ai: Settings → Connectors → Add custom connector.');
  io.say(
    '          Paste the address, click Add, then Connect, and log in with your Forest account.',
  );
  await io.pressEnter('Press Enter when Claude shows the connector as connected');
  io.say('\n  Step 2 (optional). To let Claude start a workflow: in Forest, open the workflow,');
  io.say('          then Triggers → switch on MCP.');
  await io.pressEnter('Press Enter for example prompts');
  io.say('\n  Step 3. Ask Claude, for example, on the demo bank:');
  EXAMPLE_PROMPTS.forEach(prompt => io.say(`    "${prompt}"`));
}

/** A gateway already on its port: reuse it with its tunnel, and leave both running. */
async function reuseRunning(options: McpOptions): Promise<void> {
  const { io } = options;
  const port = options.port ?? MCP_PORT;
  const url = await runningTunnel();

  if (url && (await status(`${url}/health`, 8000)) === 200) {
    io.say(`  The Forest MCP server already runs on :${port}, behind the tunnel ${url}.`);
    await guide(url, options);
  } else {
    io.say(`  Something already answers on :${port}, but no tunnel reaches it.`);
    io.say(`  Stop what runs on port ${port}, or pick another one with --port.`);
  }
}

/** Says what is missing before anything starts, or null when everything is there. */
async function missing(options: McpOptions, env: Record<string, string>): Promise<string | null> {
  if (!env.FOREST_ENV_SECRET) return 'No Forest project here. Run this from your project folder.';

  const agentUrl = localAgentUrl(env);
  if (!(await agentAnswers(agentUrl))) {
    return `Your agent isn't answering on ${agentUrl}. Start it (npm start), then try again.`;
  }

  const nodeVersion = options.nodeVersion ?? process.versions.node;
  if (!supportsGateway(nodeVersion)) {
    return `Forest's MCP server needs Node ${GATEWAY_MIN_NODE.join(
      '.',
    )} or later (this is Node ${nodeVersion}).`;
  }

  return null;
}

/** The whole flow. Resolves once the tunnel and the gateway it started are stopped. */
export async function runMcp(options: McpOptions): Promise<void> {
  const { io } = options;
  const port = options.port ?? MCP_PORT;
  const env = readProjectEnv(options.projectDir);
  const problem = await missing(options, env);

  if (problem) {
    io.say(`  ${problem}`);

    return;
  }

  // Already running (started earlier, here or elsewhere): reuse it, and leave it running.
  if ((await status(`http://localhost:${port}/health`)) === 200) {
    await reuseRunning(options);

    return;
  }

  const install =
    process.platform === 'darwin' ? 'brew install cloudflared' : `see ${CLOUDFLARED_DOWNLOADS}`;

  if (options.dryRun) {
    io.say(`  cloudflared tunnel --no-autoupdate --url http://localhost:${port} (dry-run)`);
    io.say(`  FOREST_GATEWAY_SERVICES=mcp PORT=${port} npx -y @forestadmin/gateway (dry-run)`);
    if (!hasCloudflared()) io.say(`  cloudflared is not installed: ${install}`);

    return;
  }

  if (!hasCloudflared()) {
    io.say(`  This needs cloudflared, a public tunnel to your machine. To install it: ${install}`);

    return;
  }

  const run = {
    children: [] as ChildProcess[],
    logFile: path.join(os.tmpdir(), `forest-mcp-${Date.now()}.log`),
  };
  const stop = () => run.children.forEach(stopGroup);
  const url = await startBoth(options, env, run);
  const healthy = url && (await poll(async () => (await status(`${url}/health`)) === 200, 120000));

  if (!url || !healthy) {
    if (url) io.say(`  The MCP server didn't answer through the tunnel. Its log: ${run.logFile}`);
    stop();

    return;
  }

  // claude.ai signs in through the address the server names: a wrong one fails only at Connect.
  const resource = await fetch(`${url}/.well-known/oauth-protected-resource/mcp`)
    .then(response => response.text())
    .catch(() => '');
  if (!resource.includes(url)) {
    io.say(`  Warning: the server doesn't name ${url}. Its log: ${run.logFile}`);
  }

  io.say(`  Logs: ${run.logFile}`);
  await guide(url, options);

  io.say('\n  Ctrl+C stops the MCP server and the tunnel.');
  await untilStopped(run.children, stop);
}
