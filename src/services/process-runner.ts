import type { ChildProcess, SpawnOptions } from 'child_process';

import { spawn } from 'child_process';

/**
 * Running the commands an onboarding has to drive — `npm install`, `npm start`, `bundle add`,
 * `bin/rails server` — and stopping them for real afterwards.
 *
 * Everything here exists because of one property of package managers: `npm start` is a WRAPPER.
 * The process that holds the port is its child, not the one we spawned. So a naive `child.kill()`
 * signals the wrapper, leaves the server running, and — since its pipes stay open — keeps this
 * CLI alive too. Every long-running process is therefore started in its own process group, and
 * stopped by signalling that group.
 *
 * And stopping means stopped. SIGTERM is a request a back-end is free to trap and decline — puma
 * and most servers do, for a graceful shutdown — so the group is killed outright if it is still
 * there after a grace period. On the way out of the CLI that grace is taken synchronously, because
 * by then nothing asynchronous will ever run again.
 *
 * KNOWN LIMITATION — Windows. `process.kill(-pid)` does not exist there and `detached` creates no
 * signalable group, so `stopProcess` falls back to signalling the wrapper alone: the server it
 * spawned survives, which is the very bug this module fixes elsewhere. CI is Linux-only and the
 * onboarding is not offered on Windows; if that changes, this needs `taskkill /T /F`.
 */

export type RunOptions = {
  cwd?: string;
  env?: Record<string, string>;
};

export type ProcessExit = { code: number | null; signal: NodeJS.Signals | null };

export type StartedProcess = {
  child: ChildProcess;
  /** Resolves when the process prints something matching `ready`, rejects on timeout or a taken port. */
  ready: Promise<void>;
  /**
   * Resolves when the whole GROUP has ended, however it ended — including long after `ready` did.
   *
   * `ready` only ever describes the start. A back-end that dies twenty minutes in leaves it
   * resolved and says nothing, so a caller holding one has no way to notice; this is that way.
   * It never rejects: an end is an outcome to read (`code`, or `signal` when something stopped
   * it), not a failure to catch.
   *
   * The group and not the process we spawned, because for a package manager that process is the
   * WRAPPER, and its own end says nothing — `npm start` can return in milliseconds while the
   * server it launched serves for hours. Waiting for the last of them is the only reading of
   * "it has ended" a caller can act on. The status carried is still the wrapper's, since that is
   * the only one this CLI is told; it may have been settled long before this resolves.
   */
  exited: Promise<ProcessExit>;
  /** Stop streaming output — before handing the terminal to something else, typically. */
  mute: () => void;
};

export type CaptureResult = { stdout: string; stderr: string };

const READY_TIMEOUT_MS = 120_000;

/**
 * How long a process that reported a port clash gets to recover from it.
 *
 * Reporting EADDRINUSE is not the same as failing on it: plenty of dev servers say it and then
 * bind the next port up. Killing on the spot takes down a back-end that was about to serve — so
 * the clash starts a countdown instead, and announcing readiness cancels it. The point of noticing
 * at all is kept: a start that will never happen fails here rather than at the full timeout.
 */
const PORT_CLASH_GRACE_MS = 5_000;

/** How long a process gets to honour SIGTERM before its group is killed outright. */
const STOP_GRACE_MS = 2_000;

/** The same grace, taken synchronously, when the CLI is on its way out and cannot await anything. */
const EXIT_GRACE_MS = 500;

const CAN_SIGNAL_GROUPS = process.platform !== 'win32';

/** 128 + signal number, the shell convention a caller in CI will compare against. */
const EXIT_CODE_BY_SIGNAL = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 } as const;

/**
 * Every process we started and have not stopped. Registered so the CLI can take them down with it:
 * a detached child survives its parent by design, and the terminal's Ctrl-C never reaches it (it
 * sits in its own process group), so without this a crash or an interrupt strands a server holding
 * a port the user then has to hunt down with `lsof`.
 */
const running = new Set<ChildProcess>();

/** Groups already on an escalation countdown — the one thing that must not be stacked. */
const escalating = new WeakSet<ChildProcess>();

/**
 * Groups we have watched end, and will therefore never touch again.
 *
 * A group id IS a pid, and once the last member is gone the OS is free to hand that number to
 * somebody else — so `-pid` stops meaning us at a moment nothing announces. What keeps this safe
 * is that the question only answers one way reliably: a probe saying the group is gone cannot be
 * wrong about us, while a probe saying it is there can be, once we have stopped being sure. So the
 * first "gone" is recorded as final, and after it the pid is not signalled, or even asked.
 */
const ended = new WeakSet<ChildProcess>();
let exitHookInstalled = false;

/**
 * How often a group is looked in on once the process we spawned has been reaped.
 *
 * Until then nothing is needed: while any member is alive POSIX forbids recycling the pid the
 * group carries as its id, so `-pid` can only mean us. It is the end nobody is present for — a
 * server crashing an hour in, under a CLI that started it and moved on — that has to be noticed,
 * because from there that number is fair game.
 */
const REAP_POLL_MS = 250;

/** Signal 0 only asks the question. */
function probeGroup(pid: number): boolean {
  try {
    process.kill(-pid, 0);

    return true;
  } catch {
    return false;
  }
}

/**
 * Is anything still alive in the group this child leads?
 *
 * While it answers yes the negative pid is safe to use, even after the leader itself exited:
 * POSIX forbids recycling a pid while a process group still carries it as its id. Answering no is
 * therefore the last word on that group, and retires the handle for good.
 */
function groupAlive(child: ChildProcess): boolean {
  if (!child.pid || ended.has(child)) return false;

  const alive = CAN_SIGNAL_GROUPS
    ? probeGroup(child.pid)
    : // No groups on Windows, so the leader's own exit state is all there is to go on.
      child.exitCode === null && child.signalCode === null;

  if (!alive) {
    ended.add(child);
    running.delete(child);
  }

  return alive;
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  // Windows has no group to signal, so the wrapper alone is all there is — the known limitation
  // at the top of this file. On POSIX there is no fallback worth making: the leader was IN the
  // group we just failed to signal, so its pid adds nothing, and by then that pid may belong to
  // something else entirely.
  if (!CAN_SIGNAL_GROUPS) {
    try {
      child.kill(signal);
    } catch {
      // Already dead — nothing left to stop.
    }

    return;
  }

  try {
    process.kill(-(child.pid as number), signal);
  } catch {
    // Already dead — nothing left to stop.
  }
}

/**
 * Stop a process started by `startProcess`, and everything it spawned.
 *
 * A negative pid signals the whole process group — the only way to reach the server a package
 * manager launched on our behalf. `graceMs` later, anything left in that group is killed outright.
 * Never throws: stopping something already stopped is a success.
 */
export function stopProcess(
  child: ChildProcess | undefined,
  signal: NodeJS.Signals = 'SIGTERM',
  graceMs: number = STOP_GRACE_MS,
) {
  // NOT the leader's exit state. The process we spawned is a wrapper, and it can exit while the
  // server it launched keeps the port — the very failure this module exists to prevent, reached
  // from the other side. Whether the group is still there is the question, and `groupAlive` both
  // answers it and rules out the pid the OS could have recycled. (`child.killed` is no use
  // either: it only records that `child.kill()` was called, and the group path never calls it.)
  if (!child?.pid || !groupAlive(child)) return;

  signalGroup(child, signal);

  // Signalling again is fine — the group is demonstrably still there, and a caller unwinding hard
  // must be able to follow a declined SIGTERM with a SIGKILL. Stacking countdowns is not.
  if (signal === 'SIGKILL' || escalating.has(child)) return;

  escalating.add(child);

  // A graceful SIGTERM is a request, not an outcome: a server that traps it to shut down cleanly —
  // puma, and anything with a shutdown hook of its own — keeps the port until it decides otherwise,
  // or for good. Unref'd, so this grace period never keeps the CLI alive by itself.
  const escalation = setTimeout(() => {
    if (groupAlive(child)) signalGroup(child, 'SIGKILL');
  }, graceMs);
  escalation.unref();
}

/**
 * Stop everything still running. For a caller unwinding on an error: a detached back-end survives
 * its parent, and its open pipes can keep the CLI's event loop alive, so an unhandled failure
 * would otherwise leave both a hung command and a server holding a port.
 */
export function stopAllProcesses(
  signal: NodeJS.Signals = 'SIGTERM',
  graceMs: number = STOP_GRACE_MS,
) {
  [...running].forEach(child => stopProcess(child, signal, graceMs));
}

/**
 * The same, for a process on its way out — where nothing asynchronous will ever run again.
 *
 * The escalation `stopProcess` schedules is therefore useless here, so the grace is taken
 * synchronously and whatever is still holding on is killed outright: half a second of delay on
 * Ctrl-C is a better trade than a server the user has to hunt down with `lsof`.
 */
function stopAllSync() {
  const children = [...running];
  children.forEach(child => stopProcess(child));

  if (!children.some(groupAlive)) return;

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, EXIT_GRACE_MS);
  children.forEach(child => {
    if (groupAlive(child)) signalGroup(child, 'SIGKILL');
  });
}

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;

  // `exit` covers a normal end and an uncaught throw. The signals cover the terminal, which would
  // otherwise kill this process and leave the group behind. `once`, so the handler is gone by the
  // time a second Ctrl-C arrives and the default behaviour takes it: the user can always give up,
  // at worst once the synchronous grace below is over.
  process.on('exit', stopAllSync);
  (Object.keys(EXIT_CODE_BY_SIGNAL) as (keyof typeof EXIT_CODE_BY_SIGNAL)[]).forEach(signal =>
    process.once(signal, () => {
      stopAllSync();
      process.exit(EXIT_CODE_BY_SIGNAL[signal]);
    }),
  );
}

function spawnOptions(options: RunOptions, extra: SpawnOptions = {}): SpawnOptions {
  return {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    ...extra,
  };
}

const SECRET_FLAG =
  /^--?[a-z0-9-]*(token|secret|password|passwd|pwd|apikey|api-key|auth|credential)[a-z0-9-]*$/i;

// The username may be empty — `redis://:password@host` is how Redis and Mongo URLs usually look —
// so it is `*` and not `+`, or the password right after it goes unredacted.
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/[^\s/@:]*):[^\s/@]+@/gi;

/**
 * Take the password out of any connection string in `text`.
 *
 * Both an argument list and a captured stderr routinely carry one — `bundle add`, a package
 * manager's registry token, a back-end echoing its own DATABASE_URL — and both end up inside an
 * Error that is printed, and often logged. The CLI masks the connection URL at the prompt; it must
 * not hand it back in the next failure message. The host and database survive — they are what makes
 * the failure diagnosable, and they are not the secret. Scope is deliberately narrow: a secret that
 * is neither shaped like a URL nor the value of a secret-looking flag still goes through.
 */
function redactSecrets(text: string): string {
  return text.replace(URL_CREDENTIALS, '$1:***@');
}

// `--verbose`, and nothing a credential is likely to be: a secret can start with a single `-`,
// so only this shape is taken as the next flag rather than the previous flag's value.
const LONG_FLAG = /^--[a-z0-9][a-z0-9-]*$/i;

function redactArgs(args: string[]): string[] {
  let valueIsSecret = false;

  return args.map(arg => {
    const isSecretValue = valueIsSecret && !LONG_FLAG.test(arg);
    const [flag, ...value] = arg.split('=');

    valueIsSecret = SECRET_FLAG.test(flag) && !value.length;

    if (isSecretValue) return '***';
    if (SECRET_FLAG.test(flag) && value.length) return `${flag}=***`;

    return redactSecrets(arg);
  });
}

const formatCommand = (command: string, args: string[]) =>
  `${command} ${redactArgs(args).join(' ')}`.trim();

/**
 * Run a command to completion. stdio is inherited so the child owns the terminal: `forest login`
 * can open a browser, and a package manager's own prompts and progress render natively instead of
 * being buffered into silence.
 */
export function runStep(command: string, args: string[], options: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, spawnOptions(options, { stdio: 'inherit' }));

    child.on('error', reject);
    child.on('close', code =>
      code === 0
        ? resolve()
        : reject(new Error(`\`${formatCommand(command, args)}\` exited with code ${code}`)),
    );
  });
}

/**
 * Run a command, capturing its streams SEPARATELY.
 *
 * Keeping them apart is the point: a command whose stdout is a machine-readable document writes
 * its progress to stderr, so merging the two corrupts the document — the parse then fails silently
 * and the caller proceeds with nothing. stderr is streamed through `onProgress` instead, so the
 * user still sees what is happening.
 *
 * On failure the error carries the captured stderr: piping it means the sub-command's own message
 * never reached the terminal, and "exited with code 2" alone tells the user nothing.
 */
export function runCapture(
  command: string,
  args: string[],
  { onProgress, ...options }: RunOptions & { onProgress?: (chunk: string) => void } = {},
): Promise<CaptureResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      args,
      spawnOptions(options, { stdio: ['inherit', 'pipe', 'pipe'] }),
    );
    let stdout = '';
    let stderr = '';

    // Decoded by the stream, not per chunk: a multibyte character split across two reads would
    // otherwise become two replacement characters — silently changing a value we then JSON.parse.
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (text: string) => {
      stdout += text;
    });
    child.stderr?.on('data', (text: string) => {
      stderr += text;
      onProgress?.(text);
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr });

        return;
      }

      const detail = redactSecrets((stderr || stdout).trim());
      reject(
        new Error(
          `\`${formatCommand(command, args)}\` exited with code ${code}${
            detail ? `:\n${detail}` : ''
          }`,
        ),
      );
    });
  });
}

/**
 * The line a port clash was reported on, and the port in it when the message gives one up.
 *
 * Naming the port is a courtesy, and it sits on either side of the word depending on who wrote
 * the message — node says `address already in use :::3000`, Ruby says `port 3000
 * (Errno::EADDRINUSE)`, and a unix socket names no port at all. So the clash is what is reported
 * here, with the port only when there is one to give.
 */
function portInUseError(port?: string): Error {
  return port
    ? new Error(`Port ${port} is already in use — free it with \`lsof -ti :${port} | xargs kill\`.`)
    : new Error(
        'A port it needs is already in use — free it with `lsof -ti :<port> | xargs kill`.',
      );
}

function readPortClash(text: string): { port?: string } | undefined {
  const line = /^.*EADDRINUSE.*$/m.exec(text);

  if (!line) return undefined;

  // The clock goes first. A dev server's output is normally prefixed — `12:34:56 web.1 |` from
  // foreman, overmind or docker-compose — and the first colon-number on the line is then the time,
  // not the address: the user is told to free port 34, which nobody is holding, while the port
  // that is stays in the same line unread.
  const addressed = line[0].replace(/\b\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g, ' ');
  const [, port] = /:(\d{2,5})\b/.exec(addressed) ?? /\bport (\d{2,5})\b/i.exec(addressed) ?? [];

  return { port };
}

/** Everything a starting process's output so far can say about it, which is usually nothing. */
function classifyOutput(
  text: string,
  readyPattern: RegExp,
): { ready: true } | { clash: { port?: string } } | undefined {
  if (readyPattern.test(text)) return { ready: true };

  const clash = readPortClash(text);

  return clash ? { clash } : undefined;
}

/**
 * Watch a freshly spawned process until it says it is ready, or until it is clear it never will
 * be. Resolving is the only good outcome; every rejection also stops the process, because a
 * failed start left behind keeps its pipes open and the CLI's event loop alive with them.
 */
function watchStartup(
  child: ChildProcess,
  command: string,
  ready: RegExp,
  timeoutMs: number,
  onChunk: (text: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Rebuilt without `g`/`y`: those flags make `.test()` stateful, so a caller passing `/x/g`
    // would have its `lastIndex` advance between chunks and skip the very announcement we wait
    // for — the process then dies on a timeout that had no cause.
    const readyPattern = new RegExp(ready.source, ready.flags.replace(/[gy]/g, ''));

    // One buffer PER STREAM. Sharing one would let a token straddling stdout and stderr match
    // when neither stream ever produced it. Each is capped to a suffix: a chatty process that
    // never announces itself would otherwise exhaust the heap long before the timeout fires,
    // crashing instead of reporting. The cap bounds what is KEPT, never what is looked at — see
    // `onData`, where the chunk is read together with the window before the window is trimmed.
    const WINDOW = 8192;
    const scanned = { stdout: '', stderr: '' };
    let settled = false;
    let timeout: NodeJS.Timeout;
    let portClash: NodeJS.Timeout | undefined;
    let clashedPort: string | undefined;

    const settle = () => {
      settled = true;
      clearTimeout(timeout);
      clearTimeout(portClash);
      scanned.stdout = '';
      scanned.stderr = '';
    };

    // Never longer than the wait it is meant to cut short.
    const clashGraceMs = Math.min(PORT_CLASH_GRACE_MS, Math.floor(timeoutMs / 2));

    // A failed start must not leave the process behind: its open pipes would also keep this CLI's
    // event loop alive, so the user would get an error and then a prompt that never returns.
    const fail = (error: Error) => {
      if (settled) return;
      settle();
      stopProcess(child);
      reject(error);
    };

    const onData = (source: 'stdout' | 'stderr') => (text: string) => {
      onChunk(text);
      if (settled) return;
      // Read first, trim after. A pipe hands over 8192 bytes at a time — exactly `WINDOW` — so
      // trimming first leaves no overlap at all between two full chunks, and an announcement
      // landing across that seam is never seen: the server says it is listening, and is killed on
      // a timeout for not having said it.
      const window = scanned[source] + text;
      scanned[source] = window.slice(-WINDOW);

      const verdict = classifyOutput(window, readyPattern);

      if (!verdict) return;

      if ('ready' in verdict) {
        settle();
        resolve();

        return;
      }

      clashedPort = clashedPort ?? verdict.clash.port;
      portClash = portClash ?? setTimeout(() => fail(portInUseError(clashedPort)), clashGraceMs);
    };

    timeout = setTimeout(
      () => fail(new Error(`Timed out after ${timeoutMs / 1000}s waiting for \`${command}\`.`)),
      timeoutMs,
    );

    // Decoded by the stream, not per chunk: a multibyte character split across two reads would
    // otherwise become replacement characters, and a `ready` pattern containing one would never
    // match — the process killed on a false timeout.
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', onData('stdout'));
    child.stderr?.on('data', onData('stderr'));
    child.on('error', error => fail(error));
    child.on('close', code =>
      fail(
        // `portClash`, not `clashedPort`: what was detected is the clash. Whether the message
        // also gave up a port number says nothing about what killed the process.
        portClash
          ? portInUseError(clashedPort)
          : new Error(`\`${command}\` stopped before it was ready (exit code ${code}).`),
      ),
    );
  });
}

/**
 * Start a long-running process in the background, streaming its output through `onOutput`, and
 * resolve `ready` once it prints something matching `ready` — for an agent, the line that says its
 * schema reached Forest.
 *
 * `detached` makes the child a process-group leader so `stopProcess` can take the whole tree down.
 */
export function startProcess(
  command: string,
  args: string[],
  {
    ready,
    onOutput,
    timeoutMs = READY_TIMEOUT_MS,
    ...options
  }: RunOptions & {
    ready: RegExp;
    onOutput?: (chunk: string) => void;
    timeoutMs?: number;
  },
): StartedProcess {
  installExitHook();

  const child = spawn(
    command,
    args,
    spawnOptions(options, { stdio: ['ignore', 'pipe', 'pipe'], detached: true }),
  );

  // A spawn that failed has no pid, emits `error` and `close` but never `exit`, and holds
  // nothing to stop — so it is never registered, rather than registered for good.
  if (child.pid) running.add(child);
  // Not `running.delete(child)` on the end this CLI can see: the wrapper can exit while the server
  // it started keeps running, and dropping it there puts that server out of reach of the exit hook
  // — stranded on the next Ctrl-C, holding its port. `close` is no better than `exit` for it: a
  // server logging to a file closes the pipes with its wrapper and keeps the port regardless. So
  // the leader being reaped starts watching rather than concluding, and the group is let go the
  // moment it is really gone — the end nobody would otherwise be present for being exactly the one
  // that must not be missed, since after it the pid comes back as somebody else.
  const groupEnded = new Promise<void>(resolve => {
    const endedIfGone = () => {
      if (groupAlive(child)) return false;
      resolve();

      return true;
    };

    // `close` is the cheap answer when it is one: for a wrapper that waits on what it started,
    // the pipes close with the last of the group. It is only not one when a descendant does not
    // hold them, which is why the poll exists and why neither is trusted without asking.
    child.on('close', endedIfGone);
    child.on('exit', () => {
      if (endedIfGone()) return;

      const poll = setInterval(() => {
        if (endedIfGone()) clearInterval(poll);
      }, REAP_POLL_MS);
      poll.unref();
    });
  });

  let stream = onOutput;
  const mute = () => {
    stream = undefined;
  };

  const readyPromise = watchStartup(child, command, ready, timeoutMs, text => stream?.(text));

  // The rejection is delivered to whoever awaits `ready`. Without this attachment, a process that
  // dies before being ready produces an unhandled rejection and can take the CLI down with it.
  readyPromise.catch(() => undefined);

  // Read at the group's end rather than captured at the wrapper's, so there is no order to get
  // wrong between the two listeners: node has already settled both by the time either can fire.
  const exited = groupEnded.then(() => ({ code: child.exitCode, signal: child.signalCode }));

  return { child, ready: readyPromise, exited, mute };
}
