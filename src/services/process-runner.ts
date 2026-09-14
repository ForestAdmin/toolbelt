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
   * Resolves when the process ends, however it ends — including long after `ready` did.
   *
   * `ready` only ever describes the start. A back-end that dies twenty minutes in leaves it
   * resolved and says nothing, so a caller holding one has no way to notice; this is that way.
   * It never rejects: an exit is an outcome to read (`code`, or `signal` when something stopped
   * it), not a failure to catch.
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

/** Groups we have already signalled — the one thing that must not be repeated. */
const stopped = new WeakSet<ChildProcess>();
let exitHookInstalled = false;

/**
 * Is anything still alive in the group this child leads?
 *
 * Signal 0 only asks the question. It is also what makes the negative pid safe to use after the
 * leader itself exited: POSIX forbids recycling a pid while a process group still carries it as
 * its id, so while this answers yes, `-pid` can only mean the group we started.
 */
function groupAlive(child: ChildProcess): boolean {
  if (!child.pid) return false;
  // No groups on Windows, so the leader's own exit state is all there is to go on.
  if (!CAN_SIGNAL_GROUPS) return child.exitCode === null && child.signalCode === null;

  try {
    process.kill(-child.pid, 0);

    return true;
  } catch {
    return false;
  }
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  try {
    process.kill(-(child.pid as number), signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Already dead — nothing left to stop.
    }
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
  // from the other side. What must not be repeated is the SIGNAL, so that is what is tracked;
  // `groupAlive` then rules out the pid the OS could have recycled. (`child.killed` is no use
  // either: it only records that `child.kill()` was called, and the group path never calls it.)
  if (!child?.pid || stopped.has(child) || !groupAlive(child)) return;

  stopped.add(child);
  running.delete(child);
  signalGroup(child, signal);

  if (signal === 'SIGKILL') return;

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
  // otherwise kill this process and leave the group behind. `once` so a second Ctrl-C is never
  // swallowed — the user must always be able to give up.
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

const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/[^\s/@:]+):[^\s/@]+@/gi;

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

function redactArgs(args: string[]): string[] {
  let valueIsSecret = false;

  return args.map(arg => {
    const isSecretValue = valueIsSecret && !arg.startsWith('-');
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

  running.add(child);
  child.on('close', () => running.delete(child));

  let stream = onOutput;
  const mute = () => {
    stream = undefined;
  };

  const readyPromise = new Promise<void>((resolve, reject) => {
    // Rebuilt without `g`/`y`: those flags make `.test()` stateful, so a caller passing `/x/g`
    // would have its `lastIndex` advance between chunks and skip the very announcement we wait
    // for — the process then dies on a timeout that had no cause.
    const readyPattern = new RegExp(ready.source, ready.flags.replace(/[gy]/g, ''));

    // One buffer PER STREAM. Sharing one would let a token straddling stdout and stderr match
    // when neither stream ever produced it. Each is capped to a suffix: a chatty process that
    // never announces itself would otherwise exhaust the heap long before the timeout fires,
    // crashing instead of reporting. The window is far wider than any readiness line, so a
    // pattern split across chunk boundaries still matches.
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

    const portInUse = () =>
      new Error(
        `Port ${clashedPort} is already in use — free it with \`lsof -ti :${clashedPort} | xargs kill\`.`,
      );

    // A failed start must not leave the process behind: its open pipes would also keep this CLI's
    // event loop alive, so the user would get an error and then a prompt that never returns.
    const fail = (error: Error) => {
      if (settled) return;
      settle();
      stopProcess(child);
      reject(error);
    };

    const onData = (source: 'stdout' | 'stderr') => (text: string) => {
      stream?.(text);
      if (settled) return;
      scanned[source] = (scanned[source] + text).slice(-WINDOW);

      if (readyPattern.test(scanned[source])) {
        settle();
        resolve();
        return;
      }

      // `:3000` at the end of `listen EADDRINUSE: address already in use :::3000`, so the error
      // can name the port instead of leaving the user to find it.
      const clash = !portClash && /EADDRINUSE[^\n]*?:(\d{2,5})\b/.exec(scanned[source]);

      if (clash) {
        [, clashedPort] = clash;
        portClash = setTimeout(() => fail(portInUse()), clashGraceMs);
      }
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
        clashedPort
          ? portInUse()
          : new Error(`\`${command}\` stopped before it was ready (exit code ${code}).`),
      ),
    );
  });

  // The rejection is delivered to whoever awaits `ready`. Without this attachment, a process that
  // dies before being ready produces an unhandled rejection and can take the CLI down with it.
  readyPromise.catch(() => undefined);

  const exited = new Promise<ProcessExit>(resolve => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });

  return { child, ready: readyPromise, exited, mute };
}
