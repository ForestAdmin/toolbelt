import type * as ProcessRunner from '../../src/services/process-runner';

import net from 'net';

import {
  runCapture,
  runStep,
  startProcess,
  stopAllProcesses,
  stopProcess,
} from '../../src/services/process-runner';

// `& wait` keeps the wrapper alive with the server as its child, like `npm start`. A bare
// `sh -c 'cmd'` would exec into a single process.
const SERVER = `node -e "require('net').createServer().listen(PORT,()=>console.log('listening'));setInterval(()=>{},1e3)"`;
const wrapper = (port: number) => ['-c', `${SERVER.replace('PORT', String(port))} & wait`];

const orphaningWrapper = (port: number) => [
  '-c',
  `${SERVER.replace('PORT', String(port))} & sleep 0.3`,
];

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

      expect(JSON.parse(stdout)).toStrictEqual({ secret: 's3cret' });
      expect(stderr).toContain('spinner');
      expect(progress.join('')).toContain('spinner');
    });

    it('decodes multibyte characters split across pipe chunks', async () => {
      expect.assertions(1);
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
      const port = await freePort();
      const { child, ready } = startProcess('sh', wrapper(port), {
        ready: /listening/,
        onOutput: chunk => chunks.push(chunk),
      });

      try {
        await ready;
        expect(chunks.join('')).toContain('listening');
        await expect(isPortFree(port)).resolves.toBe(false);
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

    it('rejects when the command does not exist rather than waiting for the timeout', async () => {
      expect.assertions(1);
      const { ready } = startProcess('definitely-not-a-command', [], { ready: /listening/ });

      await expect(ready).rejects.toThrow(/ENOENT/);
    });

    it('rejects on a taken port instead of waiting for the timeout', async () => {
      expect.assertions(1);
      const port = await freePort();
      const blocker = net.createServer().listen(port);

      try {
        const { ready } = startProcess('sh', wrapper(port), { ready: /never-matches/ });
        await expect(ready).rejects.toThrow(`Port ${port} is already in use`);
      } finally {
        blocker.close();
      }
    });

    it('rejects on timeout when the process never announces itself', async () => {
      expect.assertions(1);
      const { child, ready } = startProcess('sh', wrapper(await freePort()), {
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
      const [first, second] = [await freePort(), await freePort()];
      const a = startProcess('sh', wrapper(first), { ready: /listening/ });
      const b = startProcess('sh', wrapper(second), { ready: /listening/ });
      await Promise.all([a.ready, b.ready]);

      stopAllProcesses();
      await wait(500);

      await expect(isPortFree(first)).resolves.toBe(true);
      await expect(isPortFree(second)).resolves.toBe(true);
    });
  });

  describe('stopProcess', () => {
    it('frees the port held by a GRANDCHILD, which killing the wrapper alone does not', async () => {
      expect.assertions(2);
      const port = await freePort();
      const { child, ready } = startProcess('sh', wrapper(port), { ready: /listening/ });
      await ready;
      await expect(isPortFree(port)).resolves.toBe(false);

      stopProcess(child);
      await wait(500);

      await expect(isPortFree(port)).resolves.toBe(true);
    });

    it('does not re-signal a process that already exited, whose pid the OS may have reused', async () => {
      expect.assertions(4);
      expect(() => stopProcess(undefined)).not.toThrow();

      const { child, ready } = startProcess('sh', wrapper(await freePort()), {
        ready: /listening/,
      });
      await ready;
      stopProcess(child);
      await wait(500);

      // `child.killed` stays false on the group path: `process.kill()` never sets it.
      expect(child.killed).toBe(false);
      const probed: number[] = [];
      const signalled: number[] = [];
      const realKill = process.kill.bind(process);
      jest.spyOn(process, 'kill').mockImplementation(((pid: number, sig?: NodeJS.Signals) => {
        const isProbe = sig === (0 as unknown as NodeJS.Signals);
        (isProbe ? probed : signalled).push(pid);

        return realKill(pid, sig);
      }) as typeof process.kill);
      try {
        stopProcess(child);
        expect(signalled).toStrictEqual([]);
        expect(probed).toStrictEqual([]);
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('kills the process when the start fails, instead of leaving it holding the port', async () => {
      expect.assertions(2);
      const port = await freePort();
      const { ready } = startProcess('sh', wrapper(port), {
        ready: /never-matches/,
        timeoutMs: 600,
      });

      await expect(ready).rejects.toThrow(/Timed out/);
      await wait(500);
      await expect(isPortFree(port)).resolves.toBe(true);
    });

    it('keeps only a bounded window, so a chatty process cannot exhaust the heap before timing out', async () => {
      expect.assertions(1);
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
      await expect(isPortFree(port)).resolves.toBe(false);

      await expect(waitForPortFree(port)).resolves.toBe(true);
    });

    it('takes the shorter grace of a second stop, rather than keeping the first countdown', async () => {
      expect.assertions(1);
      const port = await freePort();
      const { child, ready } = startProcess('sh', trappingWrapper(port), { ready: /listening/ });
      await ready;

      stopProcess(child, 'SIGTERM', 60_000);
      stopProcess(child, 'SIGTERM', 200);

      await expect(waitForPortFree(port, 3000)).resolves.toBe(true);
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
    function installedListeners(signal: NodeJS.Signals) {
      return new Set(process.listeners(signal));
    }

    it('kills the group synchronously on a signal, and exits 128 + the signal number', async () => {
      expect.assertions(4);
      const before = installedListeners('SIGHUP');
      const beforeExit = new Set(process.listeners('exit'));

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

      const realKill = process.kill.bind(process);
      const sent: string[] = [];
      let sentBeforeExit: string[] = [];
      jest.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals) => {
        const isProbe = signal === 0;
        if (!isProbe) sent.push(`${pid < 0 ? 'group' : 'pid'} ${signal}`);

        return realKill(pid, signal);
      }) as typeof process.kill);
      const exit = jest.spyOn(process, 'exit').mockImplementation((() => {
        sentBeforeExit = [...sent];
      }) as never);

      try {
        expect(onHangUp).toBeDefined();
        onHangUp('SIGHUP');

        expect(exit).toHaveBeenCalledWith(129);
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

      expect(error.message).not.toContain('hunter2');
      expect(error.message).toContain('postgres://forest:***@db.internal:5432/prod');
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

    it('reads the flag name as words, so a name that merely contains one is left alone', async () => {
      expect.assertions(6);
      const innocent = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--author',
        'Jane Doe',
        '--oauth-callback',
        'https://example.com/cb',
        '--no-auth',
      ]).catch((thrown: Error) => thrown);
      const camel = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--apiKey',
        'sk_live_nope',
      ]).catch((thrown: Error) => thrown);
      const glued = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--dbpassword',
        'hunter2',
        '--authtoken',
        'npm_ArEaLlYsEcReT',
      ]).catch((thrown: Error) => thrown);

      expect(innocent.message).toContain('--author Jane Doe');
      expect(innocent.message).toContain('--oauth-callback https://example.com/cb');
      expect(innocent.message).not.toContain('***');
      expect(camel.message).toContain('--apiKey ***');
      expect(glued.message).not.toContain('hunter2');
      expect(glued.message).not.toContain('npm_ArEaLlYsEcReT');
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

    it('carries and redacts the message of a command that fails on stdout alone', async () => {
      expect.assertions(2);
      const error = await runCapture('node', [
        '-e',
        'console.log("cannot reach postgres://forest:hunter2@db.internal/prod"); process.exit(3)',
      ]).catch((thrown: Error) => thrown);

      expect(error.message).not.toContain('hunter2');
      expect(error.message).toContain('cannot reach postgres://forest:***@db.internal/prod');
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
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          `node -e "console.error('Address already in use - bind(2) for 127.0.0.1 port 3000 (Errno::EADDRINUSE)');setInterval(()=>{},1e3)" & wait`,
        ],
        { ready: /never-matches/, timeoutMs: 1200 },
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
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          `node -e "console.error('listen EADDRINUSE: address already in use /tmp/forest.sock');setInterval(()=>{},1e3)" & wait`,
        ],
        { ready: /never-matches/, timeoutMs: 1200 },
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

      await expect(exited).resolves.toStrictEqual({ code: 7, signal: null });
    });

    it('waits for the GROUP, since a wrapper returning says nothing about what it launched', async () => {
      expect.assertions(3);
      const port = await freePort();
      const { child, ready, exited } = startProcess(
        'sh',
        [
          '-c',
          `${SERVER.replace('PORT', String(port))} >/dev/null 2>&1 & echo listening; sleep 0.3`,
        ],
        { ready: /listening/ },
      );
      await ready;
      await wait(800);

      let settled = false;
      exited.then(() => {
        settled = true;

        return undefined;
      });
      await wait(200);

      expect(child.exitCode).not.toBeNull();
      expect(settled).toBe(false);

      stopProcess(child, 'SIGKILL');

      await expect(
        Promise.race([exited.then(() => 'ended'), wait(4000).then(() => 'hung')]),
      ).resolves.toBe('ended');
    });

    it('keeps the CLI alive while it waits on a group whose pipes have closed', async () => {
      expect.assertions(2);
      const port = await freePort();
      const intervals: NodeJS.Timeout[] = [];
      const realSetInterval = global.setInterval;
      jest.spyOn(global, 'setInterval').mockImplementation(((
        ...args: Parameters<typeof setInterval>
      ) => {
        const timer = realSetInterval(...args);
        intervals.push(timer);

        return timer;
      }) as typeof setInterval);

      try {
        const { child, ready, exited } = startProcess(
          'sh',
          ['-c', `${SERVER.replace('PORT', String(port))} >/dev/null 2>&1 & echo listening`],
          { ready: /listening/ },
        );
        await ready;
        await wait(600);

        const poll = intervals.find(timer => timer.hasRef());

        expect(poll).toBeDefined();

        const cleared = jest.spyOn(global, 'clearInterval');
        stopProcess(child, 'SIGKILL');
        await exited;

        expect(cleared).toHaveBeenCalledWith(poll);
      } finally {
        jest.restoreAllMocks();
      }
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

      expect(child.exitCode).not.toBeNull();
      stopAllProcesses('SIGTERM', 200);

      await expect(waitForPortFree(port)).resolves.toBe(true);
    });
  });

  describe('a wrapper that exits before the server it started announces itself', () => {
    it('waits for the announcement, because the wrapper ending is not the start failing', async () => {
      expect.assertions(1);
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

    it('redacts a username with no password after it, where a token is written', async () => {
      expect.assertions(2);
      const error = await runCapture('node', [
        '-e',
        'console.error("fetch failed: https://ghp_s3cr3t@github.example/repo.git"); process.exit(2)',
      ]).catch((thrown: Error) => thrown);

      expect(error.message).not.toContain('ghp_s3cr3t');
      expect(error.message).toContain('https://***@github.example/repo.git');
    });

    it('reads a snake_case flag and a NAME=value assignment as words too', async () => {
      expect.assertions(4);
      const error = await runStep('node', [
        '-e',
        'process.exit(1)',
        '--',
        '--client_secret=s3cr3t',
        '--api_key',
        'k3y',
        'FOREST_ENV_SECRET=envs3cr3t',
        'NODE_ENV=production',
      ]).catch((thrown: Error) => thrown);

      expect(error.message).not.toMatch(/s3cr3t|k3y/);
      expect(error.message).toContain('--client_secret=***');
      expect(error.message).toContain('--api_key ***');
      expect(error.message).toContain('FOREST_ENV_SECRET=*** NODE_ENV=production');
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
      expect(boolean.message).toContain('--auth-token --verbose');
      expect(boolean.message).not.toContain('***');
    });
  });
  describe('an announcement that lands on a read boundary', () => {
    it('sees it, because a pipe hands over exactly as much as the window keeps', async () => {
      expect.assertions(1);
      const { child, ready } = startProcess(
        'node',
        [
          '-e',
          `process.stdout.write('x'.repeat(8188) + 'listening' + 'y'.repeat(20000));setInterval(()=>{},1e3)`,
        ],
        { ready: /listening/, timeoutMs: 2500 },
      );

      try {
        await expect(ready).resolves.toBeUndefined();
      } finally {
        stopProcess(child);
        await wait(300);
      }
    });
  });

  describe('the port named in a clash', () => {
    it('is the address, not the clock a process manager prefixes its lines with', async () => {
      expect.assertions(2);
      const { ready } = startProcess(
        'sh',
        [
          '-c',
          `echo "12:34:56 web.1 | Error: listen EADDRINUSE: address already in use 0.0.0.0:3000" >&2; sleep 5`,
        ],
        { ready: /never-matches/, timeoutMs: 1200 },
      );
      const error = await ready.catch((thrown: Error) => thrown);

      expect(error.message).toContain('Port 3000');
      expect(error.message).not.toContain('34');
    });
  });

  describe('a group that ended while nothing was watching', () => {
    it('forgets it, so a pid the OS is then free to reuse is not signalled later', async () => {
      expect.assertions(3);
      const port = await freePort();
      const { child, ready } = startProcess(
        'sh',
        [
          '-c',
          `${SERVER.replace('PORT', String(port))} >/dev/null 2>&1 & echo listening; sleep 0.3`,
        ],
        { ready: /listening/ },
      );
      await ready;
      await wait(600);

      expect(child.exitCode).not.toBeNull();

      process.kill(-(child.pid as number), 'SIGKILL');
      await expect(waitForPortFree(port)).resolves.toBe(true);
      await wait(600);

      const probed: number[] = [];
      const realKill = process.kill.bind(process);
      jest.spyOn(process, 'kill').mockImplementation(((pid: number, signal?: NodeJS.Signals) => {
        probed.push(pid);

        return realKill(pid, signal);
      }) as typeof process.kill);

      try {
        stopAllProcesses();
        expect(probed).not.toContain(-(child.pid as number));
      } finally {
        jest.restoreAllMocks();
      }
    });
  });
});
