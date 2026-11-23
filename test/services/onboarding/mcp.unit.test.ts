import fs from 'fs';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';

import { EXAMPLE_PROMPTS, runMcp, supportsGateway } from '../../../src/services/onboarding/mcp';

// A helper (not a jest hook): this repo forbids beforeEach/afterEach (jest/no-hooks).
function fakeIO() {
  const say = jest.fn();

  return {
    say,
    pressEnter: jest.fn().mockResolvedValue(undefined),
    copy: jest.fn(),
    lines: () => say.mock.calls.map(([text]) => text).join('\n'),
  };
}

function projectWith(dotenv: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-mcp-test-'));
  fs.writeFileSync(path.join(dir, '.env'), dotenv);

  return dir;
}

/** An agent stand-in: anything that answers on a port. */
async function withAgent(body: (port: number) => Promise<void>): Promise<void> {
  const server = http.createServer((_, response) => response.writeHead(404).end());
  await new Promise<void>(resolve => {
    server.listen(0, resolve);
  });

  try {
    await body((server.address() as { port: number }).port);
  } finally {
    // Node 18 waits for idle keep-alive connections on close: end them first.
    server.closeAllConnections();
    await new Promise(resolve => {
      server.close(resolve);
    });
  }
}

/** A port free right now: listened on, then closed. */
async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>(resolve => {
    server.listen(0, resolve);
  });
  const { port } = server.address() as net.AddressInfo;
  await new Promise(resolve => {
    server.close(resolve);
  });

  return port;
}

describe('forest mcp', () => {
  it('says so outside a project folder, and starts nothing', async () => {
    expect.assertions(2);
    const io = fakeIO();

    await runMcp({ projectDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-')), io });

    expect(io.lines()).toMatch(/No Forest project here/);
    expect(io.copy).not.toHaveBeenCalled();
  });

  it('asks to start the agent when nothing answers on its port', async () => {
    expect.assertions(1);
    const io = fakeIO();

    await runMcp({ projectDir: projectWith('FOREST_ENV_SECRET=s\nAPPLICATION_PORT=1\n'), io });

    expect(io.lines()).toMatch(/isn't answering on http:\/\/localhost:1\b/);
  });

  it("refuses a Node older than the gateway's, with both versions", async () => {
    expect.assertions(1);

    await withAgent(async port => {
      const io = fakeIO();
      await runMcp({
        projectDir: projectWith(`FOREST_ENV_SECRET=s\nAPPLICATION_PORT=${port}\n`),
        io,
        nodeVersion: '20.18.0',
      });

      expect(io.lines()).toMatch(/needs Node 22\.12 or later \(this is Node 20\.18\.0\)/);
    });
  });

  it('shows what would start in a dry run, without the secrets of the .env', async () => {
    expect.assertions(3);
    // A port nothing listens on, whatever runs on the machine running the tests.
    const free = await freePort();

    await withAgent(async port => {
      const io = fakeIO();
      await runMcp({
        projectDir: projectWith(`FOREST_ENV_SECRET=sentinel-secret\nAPPLICATION_PORT=${port}\n`),
        io,
        dryRun: true,
        port: free,
        nodeVersion: '22.12.0',
      });

      expect(io.lines()).toContain(
        `cloudflared tunnel --no-autoupdate --url http://localhost:${free} (dry-run)`,
      );
      expect(io.lines()).toMatch(/npx -y @forestadmin\/gateway \(dry-run\)/);
      expect(io.lines()).not.toContain('sentinel-secret');
    });
  });

  it('refuses a port anything listens on, even what answers no HTTP, before any tunnel', async () => {
    expect.assertions(2);
    // Not an HTTP server: it would answer no health check, and still be made public.
    const holder = net.createServer(socket => socket.destroy());
    await new Promise<void>(resolve => {
      holder.listen(0, resolve);
    });
    const { port: taken } = holder.address() as net.AddressInfo;

    try {
      await withAgent(async port => {
        const io = fakeIO();
        await runMcp({
          projectDir: projectWith(`FOREST_ENV_SECRET=s\nAPPLICATION_PORT=${port}\n`),
          io,
          dryRun: true,
          port: taken,
          nodeVersion: '22.12.0',
        });

        expect(io.lines()).toContain(`Port ${taken} is taken`);
        expect(io.lines()).not.toContain('cloudflared tunnel');
      });
    } finally {
      await new Promise(resolve => {
        holder.close(resolve);
      });
    }
  });

  it('compares Node versions by major, then minor', () => {
    expect.assertions(4);
    expect(supportsGateway('22.12.0')).toBe(true);
    expect(supportsGateway('23.0.1')).toBe(true);
    expect(supportsGateway('22.11.9')).toBe(false);
    expect(supportsGateway('18.20.0')).toBe(false);
  });

  it('offers example prompts the demo bank can answer', () => {
    expect.assertions(1);
    expect(EXAMPLE_PROMPTS).toHaveLength(3);
  });
});
