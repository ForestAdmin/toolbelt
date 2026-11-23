import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

import {
  expectedGatewayVersion,
  keyProblem,
  productionSteps,
  runPortals,
  setDotenv,
} from '../../../src/services/onboarding/portals';

const FACTS = { id: '42', name: 'forest-demo-x', hasProduction: true, hasBranch: true };
const GOOD_KEY = `fgw_${'0'.repeat(16)}_good`;
const PRODUCTION_KEY = `fgw_${'0'.repeat(16)}_production`;

// A helper (not a jest hook): this repo forbids beforeEach/afterEach (jest/no-hooks).
function fakeIO(...pasted: string[]) {
  const printed: string[] = [];
  const askSecret = jest.fn();
  pasted.forEach(key => askSecret.mockResolvedValueOnce(key));

  return {
    say: (text: string) => printed.push(text),
    step: (state: string, label: string, detail = '', why = '') =>
      printed.push(`[${state}] ${label} · ${detail} ${why}`),
    panel: (title: string, lines: string[]) => printed.push(title, ...lines),
    confirm: jest.fn().mockResolvedValue(false),
    askSecret,
    pressEnter: jest.fn().mockResolvedValue(undefined),
    open: jest.fn().mockResolvedValue(undefined),
    lines: () => printed.join('\n'),
  };
}

/** A demo project folder: .env, its portals, and an agent that asks for agent-bff `peer`. */
function demoProject({ dotenv = 'FOREST_ENV_SECRET=s\n', peer = '1.46.0', bff = '1.46.0' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-portals-test-'));
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  };
  write('.env', dotenv);
  // Exits at once: the flow reports it, and nothing listens on the portals' ports.
  write('portals/partner-portal/server.js', 'process.exit(1);\n');
  write('portals/lagoon-backoffice/server.js', 'process.exit(1);\n');
  write(
    'node_modules/@forestadmin/agent/package.json',
    JSON.stringify({ peerDependencies: { '@forestadmin/agent-bff': peer } }),
  );
  if (bff) {
    write('node_modules/@forestadmin/agent-bff/package.json', JSON.stringify({ version: bff }));
  }

  return dir;
}

/**
 * An agent stand-in, answering as the real one does. With the Gateway: GOOD_KEY opens it, but
 * only with a timezone (400 without one); any other key gets 401, as a key made for another
 * environment does. Without the Gateway: 404.
 */
async function withAgent(gateway: boolean, body: (port: number) => Promise<void>): Promise<void> {
  const server = http.createServer((request, response) => {
    if (!gateway) return response.writeHead(404).end();

    if (request.headers['x-forest-gateway-key'] !== GOOD_KEY) return response.writeHead(401).end();

    return response.writeHead(request.headers['x-forest-timezone'] ? 200 : 400).end('{}');
  });
  await new Promise<void>(resolve => {
    server.listen(0, resolve);
  });

  try {
    await body((server.address() as { port: number }).port);
  } finally {
    await new Promise(resolve => {
      server.close(resolve);
    });
  }
}

// Port 1: nothing listens there, whatever runs on the machine running the tests.
const TEST_PORTAL = {
  label: 'Test portal',
  what: 'a test',
  dir: 'portals/partner-portal',
  port: 1,
};

const options = (projectDir: string, io: ReturnType<typeof fakeIO>, extra = {}) => ({
  projectDir,
  io,
  facts: jest.fn().mockResolvedValue(FACTS),
  install: jest.fn().mockResolvedValue(undefined),
  forest: jest.fn().mockResolvedValue(''),
  runAgent: jest.fn().mockReturnValue({ stop: jest.fn(), logFile: 'agent.log' }),
  portals: [TEST_PORTAL],
  ...extra,
});

const onPort = (port: number, extra = '') =>
  demoProject({ dotenv: `FOREST_ENV_SECRET=s\nAPPLICATION_PORT=${port}\n${extra}` });

describe('forest portals', () => {
  it('refuses a pasted key that is not a Gateway key, without quoting it', () => {
    expect.assertions(4);
    expect(keyProblem('')).toBe('Nothing was pasted.');
    expect(keyProblem('fgw_abc def')).toMatch(/spaces or line breaks/);
    expect(keyProblem('sk_live_secret')).not.toContain('sk_live_secret');
    expect(keyProblem('fgw_0123')).toBeNull();
  });

  it('lists the production steps with the branch and the layout after them, as Forest reports a project without production', () => {
    expect.assertions(4);
    // Without production, Forest has no branch to report: the branch is still needed after it.
    const all = productionSteps({ ...FACTS, hasProduction: false, hasBranch: true }).join('\n');

    expect(all).toContain('1. `forest environments:create -n Production -t production');
    expect(all).toContain('3. `forest branch demo --projectId 42 -o Production`');
    expect(all).toContain('4. `forest layout:apply forest-layout.json --with-workflows');
    expect(productionSteps({ ...FACTS, hasBranch: false })[0]).toContain('1. `forest branch demo');
  });

  it('sets the key on a line of its own, replacing an old one, in a file its user only can read', () => {
    expect.assertions(3);
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dotenv-')), '.env');
    fs.writeFileSync(file, 'FOREST_ENV_SECRET=s', { mode: 0o600 });

    setDotenv(file, 'FOREST_GATEWAY_KEY', 'fgw_old');
    expect(fs.readFileSync(file, 'utf8')).toBe('FOREST_ENV_SECRET=s\nFOREST_GATEWAY_KEY=fgw_old\n');

    setDotenv(file, 'FOREST_GATEWAY_KEY', 'fgw_new');
    expect(fs.readFileSync(file, 'utf8')).toBe('FOREST_ENV_SECRET=s\nFOREST_GATEWAY_KEY=fgw_new\n');
    expect(fs.statSync(file).mode.toString(8).slice(-3)).toBe('600');
  });

  it('reads the agent-bff version the installed agent asks for', () => {
    expect.assertions(1);
    expect(expectedGatewayVersion(demoProject({ peer: '1.47.0' }))).toBe('1.47.0');
  });

  it('says so outside a project, and in a project without portals', async () => {
    expect.assertions(2);
    const io = fakeIO();
    await runPortals(options(fs.mkdtempSync(path.join(os.tmpdir(), 'portals-')), io));
    expect(io.lines()).toMatch(/\[failed\] Demo project · no Forest project here/);

    const bare = demoProject();
    fs.rmSync(path.join(bare, 'portals'), { recursive: true });
    const other = fakeIO();
    await runPortals(options(bare, other));
    expect(other.lines()).toMatch(/\[failed\] Demo project · no portals in this project/);
  });

  it('installs agent-bff at the version the agent expects, then asks to restart the agent', async () => {
    expect.assertions(2);
    const io = fakeIO();
    const run = options(demoProject({ peer: '1.46.0', bff: '' }), io);

    await runPortals(run);

    expect(run.install).toHaveBeenCalledWith('1.46.0');
    expect(io.lines()).toContain('1. Restart your agent: Ctrl+C in its window, then `npm start`.');
  });

  it('only shows the install in a dry run', async () => {
    expect.assertions(2);
    const io = fakeIO();
    const run = options(demoProject({ bff: '1.45.0' }), io, { dryRun: true });

    await runPortals(run);

    expect(run.install).not.toHaveBeenCalled();
    expect(io.lines()).toContain(
      'npm install @forestadmin/agent-bff@1.46.0 --save-exact (dry-run)',
    );
  });

  it('asks for a restart when the agent runs without the Gateway', async () => {
    expect.assertions(1);

    await withAgent(false, async port => {
      const io = fakeIO();
      await runPortals(options(onPort(port), io));

      expect(io.lines()).toMatch(/\[failed\] Agent · runs without the Gateway/);
    });
  });

  it('lists the production steps when the project has no production yet, and asks for nothing', async () => {
    expect.assertions(2);

    await withAgent(true, async port => {
      const io = fakeIO();
      await runPortals(
        options(onPort(port), io, {
          facts: jest.fn().mockResolvedValue({ ...FACTS, hasProduction: false, hasBranch: true }),
        }),
      );

      expect(io.lines()).toContain('forest environments:create -n Production -t production');
      expect(io.askSecret).not.toHaveBeenCalled();
    });
  });

  it('sets up Production after a yes, in order, then goes on to the key', async () => {
    expect.assertions(5);
    const stop = jest.fn();

    await withAgent(true, async port => {
      const io = fakeIO(GOOD_KEY);
      io.confirm.mockResolvedValue(true);
      const facts = jest
        .fn()
        .mockResolvedValueOnce({ ...FACTS, hasProduction: false, hasBranch: true })
        .mockResolvedValueOnce({ ...FACTS, hasBranch: false })
        .mockResolvedValue(FACTS);
      const forest = jest.fn(async ([command]: string[]) => {
        if (command === 'environments:create') return JSON.stringify({ id: 777 });
        if (command === 'environments:get') return JSON.stringify({ secretKey: 'sentinel-secret' });

        return '';
      });
      const runAgent = jest.fn().mockReturnValue({ stop, logFile: 'agent.log' });
      await runPortals(options(onPort(port), io, { facts, forest, runAgent }));

      expect(forest.mock.calls.map(([args]) => args[0])).toStrictEqual([
        'environments:create',
        'environments:get',
        'branch',
        'layout:apply',
      ]);
      expect(runAgent).toHaveBeenCalledWith({
        FOREST_ENV_SECRET: 'sentinel-secret',
        APPLICATION_PORT: '3311',
        WORKFLOW_EXECUTOR_PORT: '3411',
      });
      expect(stop).toHaveBeenCalledTimes(1);
      expect(io.askSecret).toHaveBeenCalledTimes(1);
      expect(io.lines()).not.toContain('sentinel-secret');
    });
  });

  it('gives an inactive Production its address instead of creating another one', async () => {
    expect.assertions(1);

    await withAgent(true, async port => {
      const io = fakeIO(GOOD_KEY);
      io.confirm.mockResolvedValue(true);
      const forest = jest.fn(async ([command]: string[]) =>
        command === 'environments:get' ? JSON.stringify({ secretKey: 's' }) : '',
      );
      const facts = jest
        .fn()
        .mockResolvedValueOnce({ ...FACTS, hasProduction: false, productionId: '777' })
        .mockResolvedValue(FACTS);
      await runPortals(options(onPort(port), io, { facts, forest }));

      expect(forest.mock.calls[0][0]).toStrictEqual([
        'environments:update',
        '-e',
        '777',
        '-u',
        'http://localhost:3311',
      ]);
    });
  });

  it('shows what is left to do by hand when a step of the setup fails', async () => {
    expect.assertions(2);

    await withAgent(true, async port => {
      const io = fakeIO();
      io.confirm.mockResolvedValue(true);
      const forest = jest.fn(async ([command]: string[]) => {
        if (command === 'branch') throw new Error('`forest branch` exited with code 1:\ndetails');

        return '';
      });
      await runPortals(
        options(onPort(port), io, {
          facts: jest.fn().mockResolvedValue({ ...FACTS, hasBranch: false }),
          forest,
        }),
      );

      expect(io.lines()).toMatch(/\[failed\] Production · `forest branch` exited with code 1/);
      expect(io.lines()).toContain('To finish by hand, in this folder');
    });
  });

  it("asks to log in when Forest can't be asked about the project", async () => {
    expect.assertions(1);

    await withAgent(true, async port => {
      const io = fakeIO();
      await runPortals(
        options(onPort(port), io, {
          facts: jest.fn().mockRejectedValue(new Error('you are not logged in')),
        }),
      );

      expect(io.lines()).toContain('1. `forest login`');
    });
  });

  it('opens the service accounts page, and keeps a key the agent accepts in .env without printing it', async () => {
    expect.assertions(3);

    await withAgent(true, async port => {
      const io = fakeIO(GOOD_KEY);
      const dir = onPort(port);
      await runPortals(options(dir, io));

      expect(io.open).toHaveBeenCalledWith(
        'https://app.forestadmin.com/forest-demo-x/settings/service-accounts',
      );
      expect(fs.readFileSync(path.join(dir, '.env'), 'utf8')).toContain(
        `FOREST_GATEWAY_KEY=${GOOD_KEY}\n`,
      );
      expect(io.lines()).not.toContain(GOOD_KEY);
    });
  });

  it('refuses a key the agent refuses, made for another environment, and saves nothing', async () => {
    expect.assertions(3);

    await withAgent(true, async port => {
      const io = fakeIO(PRODUCTION_KEY, '', '');
      const dir = onPort(port);
      await runPortals(options(dir, io));

      expect(io.lines()).toMatch(/\[failed\] Gateway key · refused by your agent/);
      expect(io.lines()).toContain('your agent runs Development');
      expect(fs.readFileSync(path.join(dir, '.env'), 'utf8')).not.toContain('FOREST_GATEWAY_KEY');
    });
  });

  it('replaces a saved key the agent refuses with a new one it accepts', async () => {
    expect.assertions(3);

    await withAgent(true, async port => {
      const io = fakeIO(GOOD_KEY);
      const dir = onPort(port, `FOREST_GATEWAY_KEY=${PRODUCTION_KEY}\n`);
      await runPortals(options(dir, io));

      const dotenv = fs.readFileSync(path.join(dir, '.env'), 'utf8');
      expect(io.lines()).toMatch(/the one in \.env is refused by your agent/);
      expect(dotenv).toContain(`FOREST_GATEWAY_KEY=${GOOD_KEY}\n`);
      expect(dotenv).not.toContain(PRODUCTION_KEY);
    });
  });

  it("reports a taken port, never starting over another project's portal", async () => {
    expect.assertions(3);

    await withAgent(true, async port => {
      const io = fakeIO();
      // The agent stand-in answers on `port`: here, it plays an app already there.
      const run = options(onPort(port, `FOREST_GATEWAY_KEY=${GOOD_KEY}\n`), io, {
        portals: [{ ...TEST_PORTAL, port }],
      });
      await runPortals(run);

      expect(io.lines()).toMatch(new RegExp(`\\[failed\\] Test portal · port ${port} is taken`));
      expect(io.lines()).toContain(`\`lsof -nP -iTCP:${port} -sTCP:LISTEN\``);
      expect(io.open).not.toHaveBeenCalled();
    });
  });

  it('asks for no key when the saved one is accepted', async () => {
    expect.assertions(2);

    await withAgent(true, async port => {
      const io = fakeIO();
      await runPortals(options(onPort(port, `FOREST_GATEWAY_KEY=${GOOD_KEY}\n`), io));

      expect(io.askSecret).not.toHaveBeenCalled();
      expect(io.lines()).toMatch(/\[done\] Gateway key · in \.env, accepted by your agent/);
    });
  });
});
