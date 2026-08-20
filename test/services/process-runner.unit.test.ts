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
    it('keeps the streams apart, so progress on stderr cannot corrupt a JSON stdout', async () => {
      expect.assertions(3);
      const progress: string[] = [];
      const { stdout, stderr } = await runCapture(
        'node',
        ['-e', 'console.error("spinner"); console.log(JSON.stringify({ secret: "s3cret" }))'],
        { onProgress: chunk => progress.push(chunk) },
      );

      // Merging the two would make this parse throw, and the caller would silently get nothing.
      expect(JSON.parse(stdout)).toStrictEqual({ secret: 's3cret' });
      expect(stderr).toContain('spinner');
      // …while the user still sees the progress that was written to stderr.
      expect(progress.join('')).toContain('spinner');
    });

    it('decodes multibyte characters split across pipe chunks', async () => {
      expect.assertions(1);
      // Written one byte at a time, so every accented character straddles a chunk boundary.
      // Decoding per chunk turns each into replacement characters — and the JSON below then
      // parses to a different string than the command produced.
      const { stdout } = await runCapture('node', [
        '-e',
        'const s = JSON.stringify({ v: "créé-àé€" }); for (const b of Buffer.from(s)) process.stdout.write(Buffer.from([b]));',
      ]);

      expect(JSON.parse(stdout)).toStrictEqual({ v: 'créé-àé€' });
    });

    it('carries the failed command own message, not just its exit code', async () => {
      expect.assertions(1);
      await expect(
        runCapture('node', [
          '-e',
          'console.error("A project with this name already exists"); process.exit(2)',
        ]),
      ).rejects.toThrow(/A project with this name already exists/);
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

    it('does not re-signal a process that already exited, whose pid the OS may have reused', async () => {
      expect.assertions(3);
      expect(() => stopProcess(undefined)).not.toThrow();

      const { child, ready } = startProcess('sh', wrapper(39325), { ready: /listening/ });
      await ready;
      stopProcess(child);
      await wait(500);

      // `child.killed` stays false on the group path — `process.kill()` never sets it — so the
      // guard has to read the exit state instead, or a second call signals a recycled pid.
      expect(child.killed).toBe(false);
      const signalled: number[] = [];
      const realKill = process.kill.bind(process);
      jest.spyOn(process, 'kill').mockImplementation(((pid: number, sig?: NodeJS.Signals) => {
        signalled.push(pid);

        return realKill(pid, sig);
      }) as typeof process.kill);
      try {
        stopProcess(child);
        expect(signalled).toStrictEqual([]);
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('kills the process when the start fails, instead of leaving it holding the port', async () => {
      expect.assertions(2);
      const { ready } = startProcess('sh', wrapper(39326), {
        ready: /never-matches/,
        timeoutMs: 600,
      });

      await expect(ready).rejects.toThrow(/Timed out/);
      await wait(500);
      // Before the fix the rejection left the child alive — and its open pipes kept the CLI's
      // event loop alive with it, so the command never returned to the prompt.
      await expect(isPortFree(39326)).resolves.toBe(true);
    });

    it('stops scanning once ready, so a chatty back-end does not grow an unbounded buffer', async () => {
      expect.assertions(2);
      const scans: number[] = [];
      const ready = {
        test: (s: string) => {
          scans.push(s.length);
          return /listening/.test(s);
        },
      } as RegExp;
      const { child, ready: readyPromise } = startProcess(
        'sh',
        [
          '-c',
          "node -e \"console.log('listening'); setInterval(()=>console.log('x'.repeat(500)), 20)\" & wait",
        ],
        { ready },
      );

      try {
        await readyPromise;
        const atReady = scans.length;
        await wait(600);
        // The regex is not re-run at all after ready; before the fix it ran on every chunk, over
        // an ever-growing string, for the whole life of the process.
        expect(scans).toHaveLength(atReady);
        expect(Math.max(...scans)).toBeLessThan(2000);
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });

    it('mutes the stream on request, so back-end logs stop corrupting a handed-over terminal', async () => {
      expect.assertions(2);
      const chunks: string[] = [];
      const { child, ready, mute } = startProcess(
        'sh',
        [
          '-c',
          "node -e \"console.log('listening'); setInterval(()=>console.log('noise'), 20)\" & wait",
        ],
        { ready: /listening/, onOutput: chunk => chunks.push(chunk) },
      );

      try {
        await ready;
        mute();
        const afterMute = chunks.length;
        await wait(400);
        expect(chunks).toHaveLength(afterMute);
        expect(chunks.join('')).toContain('listening');
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });
  });
});
