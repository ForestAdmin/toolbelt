import net from 'net';

import { runCapture, runStep, startProcess, stopProcess } from '../../src/services/process-runner';

// A wrapper that stays alive and whose CHILD holds the port — the shape of `npm start`, and the
// whole reason this service exists. `sh -c 'cmd'` alone would exec and collapse into one process,
// which is exactly the case that never reproduced the bug.
const SERVER = `node -e "require('net').createServer().listen(PORT,()=>console.log('listening'));setInterval(()=>{},1e3)"`;
const wrapper = (port: number) => ['-c', `${SERVER.replace('PORT', String(port))} & wait`];

function isPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const probe = net.connect(port, '127.0.0.1');
    probe.on('connect', () => {
      probe.destroy();
      resolve(false);
    });
    probe.on('error', () => resolve(true));
  });
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('process-runner', () => {
  describe('runStep', () => {
    it('resolves when the command succeeds', async () => {
      expect.assertions(1);
      await expect(runStep('node', ['-e', 'process.exit(0)'])).resolves.toBeUndefined();
    });

    it('rejects with the exit code when the command fails', async () => {
      expect.assertions(1);
      await expect(runStep('node', ['-e', 'process.exit(3)'])).rejects.toThrow(
        /exited with code 3/,
      );
    });

    it('rejects when the command does not exist rather than hanging', async () => {
      expect.assertions(1);
      await expect(runStep('definitely-not-a-command', [])).rejects.toThrow(/ENOENT/);
    });
  });

  describe('runCapture', () => {
    it('returns stdout and stderr, so secrets printed either way can be read back', async () => {
      expect.assertions(2);
      const output = await runCapture('node', ['-e', 'console.log("out"); console.error("err")']);
      expect(output).toContain('out');
      expect(output).toContain('err');
    });
  });

  describe('startProcess', () => {
    it('resolves ready on the expected output and streams it to the caller', async () => {
      expect.assertions(2);
      const chunks: string[] = [];
      const { child, ready } = startProcess('sh', wrapper(39321), {
        ready: /listening/,
        onOutput: chunk => chunks.push(chunk),
      });

      try {
        await ready;
        expect(chunks.join('')).toContain('listening');
        await expect(isPortFree(39321)).resolves.toBe(false);
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });

    it('rejects when the process dies before it is ready', async () => {
      expect.assertions(1);
      const { ready } = startProcess('node', ['-e', 'process.exit(1)'], { ready: /never/ });

      await expect(ready).rejects.toThrow(/stopped before it was ready/);
    });

    it('rejects on a taken port instead of waiting for the timeout', async () => {
      expect.assertions(1);
      const blocker = net.createServer().listen(39322);

      try {
        const { ready } = startProcess('sh', wrapper(39322), { ready: /never-matches/ });
        await expect(ready).rejects.toThrow(/Port already in use/);
      } finally {
        blocker.close();
      }
    });

    it('rejects on timeout when the process never announces itself', async () => {
      expect.assertions(1);
      const { child, ready } = startProcess('sh', wrapper(39323), {
        ready: /never-matches/,
        timeoutMs: 700,
      });

      try {
        await expect(ready).rejects.toThrow(/Timed out after 0.7s/);
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });
  });

  describe('stopProcess', () => {
    it('frees the port held by a GRANDCHILD, which killing the wrapper alone does not', async () => {
      expect.assertions(2);
      const { child, ready } = startProcess('sh', wrapper(39324), { ready: /listening/ });
      await ready;
      await expect(isPortFree(39324)).resolves.toBe(false);

      stopProcess(child);
      await wait(500);

      // The whole point: `npm start` spawns the real server as its child, so signalling the
      // process we spawned leaves the port held and the CLI hanging on its open pipes.
      await expect(isPortFree(39324)).resolves.toBe(true);
    });

    it('does nothing, and does not throw, when there is no process or it is already stopped', async () => {
      expect.assertions(2);
      expect(() => stopProcess(undefined)).not.toThrow();

      const { child, ready } = startProcess('sh', wrapper(39325), { ready: /listening/ });
      await ready;
      stopProcess(child);
      await wait(300);

      expect(() => stopProcess(child)).not.toThrow();
    });
  });
});
