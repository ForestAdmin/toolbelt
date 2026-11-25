import fs from 'fs';
import net from 'net';
import path from 'path';

import { isPortFree } from '../../../src/services/onboarding/preflight';
import OnboardingUI from '../../../src/services/onboarding/ui';

/**
 * Runs `body` with a planned screen, what it writes to stdout captured. Under jest stdout is not a
 * terminal, so the screen runs in plain mode: one line per event, the mode CI logs get.
 */
async function withScreen(
  body: (ui: OnboardingUI, written: () => string) => Promise<void> | void,
): Promise<void> {
  let written = '';
  const write = jest.spyOn(process.stdout, 'write').mockImplementation(chunk => {
    written += String(chunk);

    return true;
  });
  const ui = new OnboardingUI({ rich: true, logName: 'forest-start-test' });

  try {
    ui.plan('forest-demo-test', 'demo bank on sample data', [
      { id: 'install', label: 'Installing the agent', why: 'npm downloads it once.' },
      { id: 'boot', label: 'Starting the agent' },
    ]);
    await body(ui, () => written);
  } finally {
    write.mockRestore();
    fs.rmSync(path.dirname(ui.logFile), { recursive: true, force: true });
  }
}

describe('the onboarding screen, in plain mode', () => {
  it('prints each step and its detail, and keeps the output of the commands in the log', async () => {
    expect.assertions(7);

    await withScreen(async (ui, written) => {
      await ui.run('install', async step => {
        step.log('$ npm install');
        step.log('\u001b[32madded 312 packages\u001b[0m');
        step.detail('dependencies installed');
      });

      expect(ui.rich).toBe(false);
      expect(written()).toContain('Installing the agent');
      expect(written()).toContain('dependencies installed');
      expect(written()).not.toContain('added 312 packages');
      expect(fs.readFileSync(ui.logFile, 'utf8')).toContain('added 312 packages');
      // The temp folder is shared on Linux: the log is its user's only, in a folder of its own.
      expect(fs.statSync(ui.logFile).mode.toString(8).slice(-3)).toBe('600');
      expect(fs.statSync(path.dirname(ui.logFile)).mode.toString(8).slice(-3)).toBe('700');
    });
  });

  it('marks the failed step with its first line, and keeps the rest for the log tail', async () => {
    expect.assertions(3);

    await withScreen(async (ui, written) => {
      await expect(
        ui.run('boot', async step => {
          step.log('Error: listen EADDRINUSE :::3310');
          throw new Error('`npm start` exited with code 1:\nError: listen EADDRINUSE :::3310');
        }),
      ).rejects.toThrow('exited with code 1');

      expect(written()).toContain('`npm start` exited with code 1');
      expect(ui.logTail()).toContain('Error: listen EADDRINUSE :::3310');
    });
  });

  it('logs what arrives after its step without printing it', async () => {
    expect.assertions(2);

    await withScreen((ui, written) => {
      ui.record('[forest] Schema was updated');

      expect(written()).not.toContain('Schema was updated');
      expect(ui.logTail()).toContain('[forest] Schema was updated');
    });
  });

  it('refuses a step that was never planned', async () => {
    expect.assertions(1);

    await withScreen(async ui => {
      await expect(ui.run('layout', async () => {})).rejects.toThrow(
        'Unknown onboarding step: layout',
      );
    });
  });
});

describe('the onboarding screen, on a terminal', () => {
  it('never moves the cursor above the window when the checklist is taller than it', async () => {
    expect.assertions(2);
    const stdout = process.stdout as NodeJS.WriteStream;
    const saved = { isTTY: stdout.isTTY, rows: stdout.rows, columns: stdout.columns };
    Object.assign(stdout, { isTTY: true, rows: 8, columns: 80 });
    let written = '';
    const write = jest.spyOn(process.stdout, 'write').mockImplementation(chunk => {
      written += String(chunk);

      return true;
    });
    const ui = new OnboardingUI({ rich: true, logName: 'forest-start-test' });

    try {
      ui.plan('forest-demo-test', 'demo bank on sample data', [
        { id: 'preflight', label: 'Checking this computer', why: 'Node and the ports.' },
        { id: 'create', label: 'Registering the project on Forest', why: 'Its secrets.' },
        { id: 'install', label: 'Installing the agent', why: 'npm downloads it once.' },
        { id: 'boot', label: 'Starting the agent', why: 'It sends Forest the tables.' },
        { id: 'layout', label: 'Applying the demo layout', why: 'Workspaces and workflows.' },
      ]);
      await ui.run('install', async step => {
        step.log('$ npm install');
        step.detail('dependencies installed');
      });
      ui.release();

      // eslint-disable-next-line no-control-regex
      const ups = [...written.matchAll(/\x1b\[(\d+)A/g)].map(match => Number(match[1]));
      expect(ups.length).toBeGreaterThan(0);
      expect(Math.max(...ups)).toBeLessThan(8);
    } finally {
      write.mockRestore();
      Object.assign(stdout, saved);
      fs.rmSync(path.dirname(ui.logFile), { recursive: true, force: true });
    }
  });
});

describe('isPortFree', () => {
  const listening = async (host?: string) => {
    const server = net.createServer();
    await new Promise<void>(resolve => {
      server.listen(0, host, resolve);
    });

    return server;
  };
  const closed = (server: net.Server) =>
    new Promise(resolve => {
      server.close(resolve);
    });

  it('sees a port held the way an agent holds it, on every interface', async () => {
    expect.assertions(2);
    const server = await listening();
    const { port } = server.address() as net.AddressInfo;

    await expect(isPortFree(port)).resolves.toBe(false);
    await closed(server);
    await expect(isPortFree(port)).resolves.toBe(true);
  });

  it('sees a port held on the loopback only', async () => {
    expect.assertions(1);
    const server = await listening('127.0.0.1');
    const { port } = server.address() as net.AddressInfo;

    await expect(isPortFree(port)).resolves.toBe(false);
    await closed(server);
  });
});
