import type * as ProcessRunner from '../../src/services/process-runner';

import net from 'net';

import {
  runCapture,
  runStep,
  startProcess,
  stopAllProcesses,
  stopProcess,
} from '../../src/services/process-runner';

// A wrapper that stays alive and whose CHILD holds the port — the shape of `npm start`, and the
// whole reason this service exists. `sh -c 'cmd'` alone would exec and collapse into one process,
// which is exactly the case that never reproduced the bug.
const SERVER = `node -e "require('net').createServer().listen(PORT,()=>console.log('listening'));setInterval(()=>{},1e3)"`;
const wrapper = (port: number) => ['-c', `${SERVER.replace('PORT', String(port))} & wait`];

// The same server, but the wrapper returns while it keeps running — `npm start` dying, or any
// launcher that hands over and leaves. The server stays in the group the wrapper led.
const orphaningWrapper = (port: number) => [
  '-c',
  `${SERVER.replace('PORT', String(port))} & sleep 0.3`,
];

// A server that traps SIGTERM to shut down gracefully, as puma and most back-ends do. SIGTERM is a
// request it is free to ignore, so nothing but SIGKILL ever gets the port back.
const TRAPPING_SERVER = `node -e "process.on('SIGTERM',()=>{});require('net').createServer().listen(PORT,()=>console.log('listening'));setInterval(()=>{},1e3)"`;
const trappingWrapper = (port: number) => [
  '-c',
  `${TRAPPING_SERVER.replace('PORT', String(port))} & wait`,
];

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

// A signal is delivered synchronously; the socket the kernel then frees is not. So the effect is
// polled for, and what has to happen synchronously is asserted on the signals themselves.
async function waitForPortFree(port: number, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return true;
    // eslint-disable-next-line no-await-in-loop
    await wait(50);
  }

  return isPortFree(port);
}

// Asked of the OS rather than hardcoded. These tests are about servers that outlive what started
// them, so a run that leaves one behind must not be able to poison the next one.
function freePort(): Promise<number> {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

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

    it('matches a stateful ready pattern, whose lastIndex would otherwise skip the announcement', async () => {
      expect.assertions(1);
      const { child, ready } = startProcess(
        'sh',
        ['-c', 'node -e "setInterval(()=>console.log(\'server listening now\'), 30)" & wait'],
        // `/y/` is sticky: `.test()` advances lastIndex, so a second call misses a match the
        // first one already passed — the process would die on a timeout that had no cause.
        { ready: /listening/y, timeoutMs: 3000 },
      );

      try {
        await expect(ready).resolves.toBeUndefined();
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });

    it('does not accept a token straddling stdout and stderr, which neither stream produced', async () => {
      expect.assertions(1);
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          "node -e \"process.stdout.write('READ'); process.stderr.write('Y-NOW'); setInterval(()=>{},1e3)\" & wait",
        ],
        { ready: /READY-NOW/, timeoutMs: 800 },
      );

      try {
        await expect(ready).rejects.toThrow(/Timed out/);
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
        await expect(ready).rejects.toThrow(/Port 39322 is already in use/);
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

  describe('stopAllProcesses', () => {
    it('takes down everything still running, for a caller unwinding on an error', async () => {
      expect.assertions(2);
      const a = startProcess('sh', wrapper(39327), { ready: /listening/ });
      const b = startProcess('sh', wrapper(39328), { ready: /listening/ });
      await Promise.all([a.ready, b.ready]);

      stopAllProcesses();
      await wait(500);

      await expect(isPortFree(39327)).resolves.toBe(true);
      await expect(isPortFree(39328)).resolves.toBe(true);
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
      expect.assertions(4);
      expect(() => stopProcess(undefined)).not.toThrow();

      const { child, ready } = startProcess('sh', wrapper(39325), { ready: /listening/ });
      await ready;
      stopProcess(child);
      await wait(500);

      // `child.killed` stays false on the group path — `process.kill()` never sets it — so the
      // guard cannot read that, and a second call would otherwise signal a recycled pid.
      expect(child.killed).toBe(false);
      const probed: number[] = [];
      const signalled: number[] = [];
      const realKill = process.kill.bind(process);
      jest.spyOn(process, 'kill').mockImplementation(((pid: number, sig?: NodeJS.Signals) => {
        // Signal 0 asks whether the group is still there and stops nothing; it is the check, not
        // the thing being checked for.
        (sig === (0 as unknown as NodeJS.Signals) ? probed : signalled).push(pid);

        return realKill(pid, sig);
      }) as typeof process.kill);
      try {
        stopProcess(child);
        expect(signalled).toStrictEqual([]);
        // …and it did ask, rather than remembering: what makes this safe is that the group is
        // gone, not that we happen to have stopped this child before.
        expect(probed).toStrictEqual([-(child.pid as number)]);
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

    it('keeps only a bounded window, so a chatty process cannot exhaust the heap before timing out', async () => {
      expect.assertions(1);
      // 40 KB of noise between the two halves of the pattern. Retaining everything would match;
      // a bounded window cannot — which is the point: before the cap, a process that never
      // announced itself grew the buffer until the CLI crashed, instead of reporting a timeout.
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          "node -e \"process.stdout.write('BEGIN'); process.stdout.write('x'.repeat(40000)); process.stdout.write('END'); setInterval(()=>{},1e3)\" & wait",
        ],
        { ready: /BEGIN[\s\S]*END/, timeoutMs: 900 },
      );

      try {
        await expect(ready).rejects.toThrow(/Timed out/);
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

  describe('stopProcess — a wrapper that exits first', () => {
    it('still frees the port when the wrapper is gone and only its child is left', async () => {
      expect.assertions(3);
      const port = await freePort();
      const { child, ready } = startProcess('sh', orphaningWrapper(port), { ready: /listening/ });
      await ready;
      await wait(800);

      // The wrapper has returned; the server it started has not. Reading the leader's exit state
      // to decide whether to signal makes `stopProcess` a no-op here — and the port stays held,
      // which is the exact bug this module exists to fix, reached from the other side.
      expect(child.exitCode).not.toBeNull();
      await expect(isPortFree(port)).resolves.toBe(false);

      stopProcess(child, 'SIGTERM', 200);

      await expect(waitForPortFree(port)).resolves.toBe(true);
    });
  });

  describe('stopProcess — a process that traps SIGTERM', () => {
    it('escalates to SIGKILL, because a graceful signal is a request and not an outcome', async () => {
      expect.assertions(2);
      const port = await freePort();
      const { child, ready } = startProcess('sh', trappingWrapper(port), { ready: /listening/ });
      await ready;

      stopProcess(child, 'SIGTERM', 250);
      await wait(150);
      // Still there: it caught the signal and simply declined to leave.
      await expect(isPortFree(port)).resolves.toBe(false);

      await expect(waitForPortFree(port)).resolves.toBe(true);
    });

    it('escalates through stopAllProcesses too, for a caller unwinding on an error', async () => {
      expect.assertions(1);
      const port = await freePort();
      const { ready } = startProcess('sh', trappingWrapper(port), { ready: /listening/ });
      await ready;

      stopAllProcesses('SIGTERM', 250);

      await expect(waitForPortFree(port)).resolves.toBe(true);
    });
  });

  describe('the exit hook', () => {
    // The handlers are installed on the shared `process`, so they are captured and removed again:
    // a test must not leave the runner with a listener that calls `process.exit`.
    function installedListeners(signal: NodeJS.Signals) {
      return new Set(process.listeners(signal));
    }

    it('kills the group synchronously on a signal, and exits 128 + the signal number', async () => {
      expect.assertions(4);
      const before = installedListeners('SIGHUP');
      const beforeExit = new Set(process.listeners('exit'));

      // A fresh instance, so `installExitHook` runs again in a module the suite already loaded.
      let runner!: typeof ProcessRunner;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        runner = require('../../src/services/process-runner');
      });

      const port = await freePort();
      const { ready } = runner.startProcess('sh', trappingWrapper(port), { ready: /listening/ });
      await ready;

      const onHangUp = process.listeners('SIGHUP').find(listener => !before.has(listener)) as (
        signal: NodeJS.Signals,
      ) => void;

      // What the hook signalled, as of the moment it called `process.exit` — the property under
      // test is that both signals are already out by then, because nothing asynchronous it might
      // have scheduled would ever run.
      const realKill = process.kill.bind(process);
      const sent: string[] = [];
      let sentBeforeExit: string[] = [];
      jest.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals) => {
        // Signal 0 only asks whether the group is still there; it stops nothing.
        if (signal !== 0) sent.push(`${pid < 0 ? 'group' : 'pid'} ${signal}`);

        return realKill(pid, signal);
      }) as typeof process.kill);
      const exit = jest.spyOn(process, 'exit').mockImplementation((() => {
        sentBeforeExit = [...sent];
      }) as never);

      try {
        expect(onHangUp).toBeDefined();
        onHangUp('SIGHUP');

        // SIGHUP is 1, so 129 — not the 143 that belongs to SIGTERM.
        expect(exit).toHaveBeenCalledWith(129);
        // The graceful signal, then the one it cannot decline — both before the process leaves.
        expect(sentBeforeExit).toStrictEqual(['group SIGTERM', 'group SIGKILL']);
        await expect(waitForPortFree(port)).resolves.toBe(true);
      } finally {
        jest.restoreAllMocks();
        process
          .listeners('SIGHUP')
          .filter(listener => !before.has(listener))
          .forEach(listener => process.removeListener('SIGHUP', listener));
        (['SIGINT', 'SIGTERM'] as const).forEach(signal =>
          process
            .listeners(signal)
            .filter(listener => !installedListeners(signal).has(listener))
            .forEach(listener => process.removeListener(signal, listener)),
        );
        process
          .listeners('exit')
          .filter(listener => !beforeExit.has(listener))
          .forEach(listener => process.removeListener('exit', listener));
      }
    });
  });

  describe('secrets in error messages', () => {
    it('strips the password from a connection URL passed as an argument', async () => {
      expect.assertions(3);
      const error = await runCapture('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--connection-url',
        'postgres://forest:hunter2@db.internal:5432/prod',
      ]).catch((thrown: Error) => thrown);

      // The CLI masks this very value at the prompt; handing it back in the failure it caused,
      // into a terminal and whatever collects its output, undoes that.
      expect(error.message).not.toContain('hunter2');
      expect(error.message).toContain('postgres://forest:***@db.internal:5432/prod');
      // …while everything that makes the message useful survives.
      expect(error.message).toContain('--connection-url');
    });

    it('drops the value of a secret-looking flag, in both of its spellings', async () => {
      expect.assertions(4);
      const spaced = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--auth-token',
        'npm_ArEaLlYsEcReT',
      ]).catch((thrown: Error) => thrown);
      const joined = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--password=correct-horse',
      ]).catch((thrown: Error) => thrown);

      expect(spaced.message).not.toContain('npm_ArEaLlYsEcReT');
      expect(spaced.message).toContain('--auth-token ***');
      expect(joined.message).not.toContain('correct-horse');
      expect(joined.message).toContain('--password=***');
    });

    it('strips it from the captured stderr the error carries, not just from the arguments', async () => {
      expect.assertions(2);
      const error = await runCapture('node', [
        '-e',
        'console.error("could not connect to mysql://root:s3cr3t@10.0.0.4:3306/app"); process.exit(2)',
      ]).catch((thrown: Error) => thrown);

      expect(error.message).not.toContain('s3cr3t');
      expect(error.message).toContain('could not connect to mysql://root:***@10.0.0.4:3306/app');
    });

    it('leaves an ordinary argument alone, so the message still says what ran', async () => {
      expect.assertions(2);
      const error = await runCapture('node', ['-e', 'process.exit(4)', '--', '--verbose']).catch(
        (thrown: Error) => thrown,
      );

      expect(error.message).toContain('--verbose');
      expect(error.message).toContain('exited with code 4');
    });
  });

  describe('startProcess — a port clash the process recovers from', () => {
    it('lets a server that falls back to another port become ready, instead of killing it', async () => {
      expect.assertions(2);
      const taken = await freePort();
      const blocker = net.createServer().listen(taken);

      // What a dev server does: report the clash, then bind the next one up and serve. Treating
      // the word EADDRINUSE as the failure itself takes down a back-end that was about to work.
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          `node -e "const net=require('net');const s=net.createServer();s.on('error',()=>{console.error('Error: listen EADDRINUSE: address already in use :::${taken}');s.listen(0,()=>console.log('listening on a free port'))});s.listen(${taken});setInterval(()=>{},1e3)" & wait`,
        ],
        { ready: /listening on a free port/, timeoutMs: 6000 },
      );

      try {
        await expect(ready).resolves.toBeUndefined();
        await expect(isPortFree(taken)).resolves.toBe(false);
      } finally {
        blocker.close();
        stopProcess(child);
        await wait(300);
      }
    });

    it('still fails fast, and names the port, when nothing recovers', async () => {
      expect.assertions(1);
      const taken = await freePort();
      const blocker = net.createServer().listen(taken);

      // Reports the clash and then just sits there. Waiting out the full timeout for a start that
      // will never happen is the thing this check exists to avoid, so the countdown must fire.
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          `node -e "const net=require('net');const s=net.createServer();s.on('error',()=>console.error('Error: listen EADDRINUSE: address already in use :::${taken}'));s.listen(${taken});setInterval(()=>{},1e3)" & wait`,
        ],
        { ready: /never-matches/, timeoutMs: 2000 },
      );

      try {
        await expect(ready).rejects.toThrow(`Port ${taken} is already in use`);
      } finally {
        blocker.close();
        stopProcess(child);
        await wait(300);
      }
    });

    it('fails fast on a message that puts the port before the word, as Ruby does', async () => {
      expect.assertions(1);
      // `Address already in use - bind(2) for "127.0.0.1" port 3000 (Errno::EADDRINUSE)`, which is
      // what `bin/rails server` prints. Reading the port only after the word finds nothing here,
      // and a start that will never happen then waits out the entire timeout.
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          `node -e "console.error('Address already in use - bind(2) for 127.0.0.1 port 3000 (Errno::EADDRINUSE)');setInterval(()=>{},1e3)" & wait`,
        ],
        { ready: /never-matches/, timeoutMs: 4000 },
      );

      try {
        await expect(ready).rejects.toThrow('Port 3000 is already in use');
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });

    it('blames the clash, not a bare exit code, when it reports one with no port and dies', async () => {
      expect.assertions(1);
      // The die-fast path. Reading the port number to decide what killed it confuses naming the
      // cause with having one: the clash is what was detected either way.
      const { ready } = startProcess(
        'sh',
        [
          '-c',
          `node -e "console.error('listen EADDRINUSE: address already in use /tmp/forest.sock');process.exit(1)" & wait $!`,
        ],
        { ready: /never-matches/, timeoutMs: 4000 },
      );

      await expect(ready).rejects.toThrow(/A port it needs is already in use/);
    });

    it('fails fast even when no port can be read from the message at all', async () => {
      expect.assertions(1);
      // A unix socket has no port to name. Naming one is a courtesy; failing fast is the point.
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          `node -e "console.error('listen EADDRINUSE: address already in use /tmp/forest.sock');setInterval(()=>{},1e3)" & wait`,
        ],
        { ready: /never-matches/, timeoutMs: 4000 },
      );

      try {
        await expect(ready).rejects.toThrow(/A port it needs is already in use/);
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });
  });

  describe('startProcess — the end of a process that did start', () => {
    it('reports a crash that happens long after ready, which nothing else surfaces', async () => {
      expect.assertions(1);
      // `wait $!` and not a bare `wait`: the latter reports 0 whatever the job did, which would
      // make this pass on a runner that never propagated the code at all.
      const { ready, exited } = startProcess(
        'sh',
        ['-c', `node -e "console.log('listening');setTimeout(()=>process.exit(7),300)" & wait $!`],
        { ready: /listening/ },
      );

      await ready;

      // `ready` described the start and is long settled. A back-end that dies twenty minutes in
      // used to leave the caller with no way to notice at all.
      await expect(exited).resolves.toStrictEqual({ code: 7, signal: null });
    });

    it('says a signal ended it, so a caller can tell a crash from its own stop', async () => {
      expect.assertions(1);
      const port = await freePort();
      const { child, ready, exited } = startProcess('sh', wrapper(port), { ready: /listening/ });
      await ready;

      stopProcess(child);

      await expect(exited).resolves.toStrictEqual({ code: null, signal: 'SIGTERM' });
    });
  });

  describe('what the exit hook can still reach', () => {
    it('keeps a stopped-but-trapping process reachable, in case the CLI leaves before it does', async () => {
      expect.assertions(1);
      const port = await freePort();
      const { child, ready } = startProcess('sh', trappingWrapper(port), { ready: /listening/ });
      await ready;

      // It was asked to stop and declined. Dropping it from the register at signal time puts it
      // out of reach of everything that runs later — and the escalation is on an unref'd timer,
      // so a CLI that exits first never fires it.
      stopProcess(child, 'SIGTERM', 60_000);
      await wait(300);

      stopAllProcesses('SIGKILL');

      await expect(waitForPortFree(port)).resolves.toBe(true);
    });

    it('keeps a server whose wrapper already exited reachable', async () => {
      expect.assertions(2);
      const port = await freePort();
      const { child, ready } = startProcess('sh', orphaningWrapper(port), { ready: /listening/ });
      await ready;
      await wait(800);

      // The wrapper's `close` has fired and the server it left behind has not. Taking that as the
      // end of the group is how a Ctrl-C strands a port.
      expect(child.exitCode).not.toBeNull();
      stopAllProcesses('SIGTERM', 200);

      await expect(waitForPortFree(port)).resolves.toBe(true);
    });
  });

  describe('a wrapper that exits before the server it started announces itself', () => {
    it('waits for the announcement, because the wrapper ending is not the start failing', async () => {
      expect.assertions(1);
      // `server &` with no `wait`: the launcher is gone in milliseconds and the server it left
      // behind holds the pipes, so `exit` fires long before the readiness line and `close` never
      // fires at all. Treating the wrapper's exit as the failure rejects a start that succeeds —
      // which is this module's own thesis, that the wrapper is not the server.
      const { child, ready } = startProcess(
        'sh',
        ['-c', `node -e "setTimeout(()=>console.log('listening'),600)" &`],
        { ready: /listening/, timeoutMs: 5000 },
      );

      try {
        await expect(ready).resolves.toBeUndefined();
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });
  });

  describe('secrets the narrow shapes still have to catch', () => {
    it('redacts a password after an empty username, as Redis and Mongo URLs are written', async () => {
      expect.assertions(2);
      const error = await runCapture('node', [
        '-e',
        'console.error("connect failed: redis://:s3cr3t@cache.internal:6379/0"); process.exit(2)',
      ]).catch((thrown: Error) => thrown);

      expect(error.message).not.toContain('s3cr3t');
      expect(error.message).toContain('redis://:***@cache.internal:6379/0');
    });

    it('redacts a secret value that starts with a dash, without eating the next flag', async () => {
      expect.assertions(4);
      const dashed = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--auth-token',
        '-dashy-looking-secret',
      ]).catch((thrown: Error) => thrown);
      const boolean = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--auth-token',
        '--verbose',
      ]).catch((thrown: Error) => thrown);

      expect(dashed.message).not.toContain('dashy-looking-secret');
      expect(dashed.message).toContain('--auth-token ***');
      // …while a flag that follows is still a flag, so the message does not claim a secret was
      // passed where none was, and still says what actually ran.
      expect(boolean.message).toContain('--auth-token --verbose');
      expect(boolean.message).not.toContain('***');
    });
  });
});
