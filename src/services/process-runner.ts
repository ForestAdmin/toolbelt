import type { ChildProcess, SpawnOptions } from 'child_process';

import { spawn } from 'child_process';

/**
 * Running the commands an onboarding has to drive — `npm install`, `npm start`, `bundle add`,
 * `bin/rails server` — and stopping them for real afterwards.
 *
 * `npm start` is a wrapper: the process holding the port is its child, not the one we spawned. So
 * a long-running process is started in its own process group and stopped by signalling that group,
 * and SIGTERM — a request a back-end is free to trap and decline — escalates to SIGKILL.
 *
 * KNOWN LIMITATION — Windows. `process.kill(-pid)` does not exist there and `detached` creates no
 * signalable group, so `stopProcess` signals the wrapper alone and the server it spawned survives.
 * CI is Linux-only and the onboarding is not offered on Windows; if that changes, this needs
 * `taskkill /T /F`.
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
   * Resolves when the whole group has ended, however it ended — long after `ready` did, typically.
   * Never rejects: an end is an outcome to read, not a failure to catch.
   *
   * The group and not the process we spawned, whose own end says nothing: `npm start` can return
   * in milliseconds while the server it launched serves for hours. The status carried is still the
   * wrapper's, being the only one this CLI is told, and may have settled long before this resolves.
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
 * bind the next port up. So the clash starts a countdown, and announcing readiness cancels it.
 */
const PORT_CLASH_GRACE_MS = 5_000;

const STOP_GRACE_MS = 2_000;

/** The same grace, taken synchronously, when the CLI is on its way out and cannot await anything. */
const EXIT_GRACE_MS = 500;

const REAP_POLL_MS = 250;

const SCAN_WINDOW = 8192;

const CAN_SIGNAL_GROUPS = process.platform !== 'win32';

/** 128 + signal number, the shell convention a caller in CI will compare against. */
const EXIT_CODE_BY_SIGNAL = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 } as const;

/**
 * Every group we started and have not seen end, so the CLI can take them down with it: a detached
 * child survives its parent by design, and the terminal's Ctrl-C never reaches it.
 */
const running = new Set<ChildProcess>();

/** The escalation countdown a group is on, kept so a later stop replaces it instead of stacking. */
const escalations = new WeakMap<ChildProcess, NodeJS.Timeout>();

const ended = new WeakSet<ChildProcess>();

let exitHookInstalled = false;

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
 * A group id is a pid, so the question only answers one way reliably. While it is yes, `-pid` can
 * only mean us: POSIX forbids recycling a pid while a process group still carries it as its id.
 * Once it is no the number is fair game, so that answer is final and the handle is retired — asking
 * again could get a yes about somebody else.
 */
function groupAlive(child: ChildProcess): boolean {
  if (!child.pid || ended.has(child)) return false;

  const alive = CAN_SIGNAL_GROUPS
    ? probeGroup(child.pid)
    : child.exitCode === null && child.signalCode === null;

  if (!alive) {
    ended.add(child);
    running.delete(child);
  }

  return alive;
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  try {
    if (CAN_SIGNAL_GROUPS) process.kill(-(child.pid as number), signal);
    else child.kill(signal);
  } catch {
    // Already gone.
  }
}

/**
 * Register the group so the exit hook can reach it, and resolve once the last of it is gone.
 *
 * Neither end this CLI is handed is the group's: `close` waits on pipes a descendant need not hold,
 * `exit` is only the leader being reaped. So both are taken as a prompt to ask, never as an answer.
 */
function trackGroup(child: ChildProcess): Promise<void> {
  if (child.pid) running.add(child);

  return new Promise(resolve => {
    const resolveIfGone = () => {
      if (groupAlive(child)) return false;

      resolve();

      return true;
    };

    child.on('close', resolveIfGone);
    child.on('exit', () => {
      if (resolveIfGone()) return;

      const poll = setInterval(() => {
        if (resolveIfGone()) clearInterval(poll);
      }, REAP_POLL_MS);
      poll.unref();
    });
  });
}

/**
 * Stop a process started by `startProcess`, and everything it spawned. `graceMs` later, anything
 * left in the group is killed outright. Never throws: stopping something already stopped is a
 * success.
 */
export function stopProcess(
  child: ChildProcess | undefined,
  signal: NodeJS.Signals = 'SIGTERM',
  graceMs: number = STOP_GRACE_MS,
) {
  if (!child?.pid || !groupAlive(child)) return;

  signalGroup(child, signal);
  clearTimeout(escalations.get(child));

  if (signal === 'SIGKILL') return;

  const escalation = setTimeout(() => {
    if (groupAlive(child)) signalGroup(child, 'SIGKILL');
  }, graceMs);
  escalation.unref();
  escalations.set(child, escalation);
}

/**
 * Stop everything still running. For a caller unwinding on an error: a detached back-end survives
 * its parent, and its open pipes can keep the CLI's event loop alive.
 */
export function stopAllProcesses(
  signal: NodeJS.Signals = 'SIGTERM',
  graceMs: number = STOP_GRACE_MS,
) {
  [...running].forEach(child => stopProcess(child, signal, graceMs));
}

/** The only wait left on the way out, where no timer will ever fire again. */
function blockFor(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * The same, for a process on its way out. Half a second of delay on Ctrl-C is a better trade than
 * a server the user has to hunt down with `lsof`.
 */
function stopAllSync() {
  const children = [...running];
  children.forEach(child => stopProcess(child));

  if (!children.some(groupAlive)) return;

  blockFor(EXIT_GRACE_MS);
  children.forEach(child => {
    if (groupAlive(child)) signalGroup(child, 'SIGKILL');
  });
}

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;

  process.on('exit', stopAllSync);
  // `once`, so a second Ctrl-C meets the default behaviour: the user can always give up.
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

const SECRET_WORDS = new Set([
  'apikey',
  'auth',
  'credential',
  'credentials',
  'passwd',
  'password',
  'pwd',
  'secret',
  'token',
]);

/** OAuth is the protocol, not the credential: `--oauth-token` is one, `--oauth-callback` is not. */
const NOT_SECRET_WORDS = new Set(['oauth']);

const FLAG_NAME = /^--?([a-z0-9][a-z0-9-]*)$/i;

const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;

const TRAILING_DIGITS = /\d+$/;

/**
 * Does the name of this word say it is a secret?
 *
 * A suffix and not a substring: `dbpassword` and `authtoken` are credentials written without a
 * separator, while `author` merely starts with one of the words and `tokenfile` names a path.
 */
function isSecretWord(word: string): boolean {
  if (NOT_SECRET_WORDS.has(word)) return false;

  const bare = word.replace(TRAILING_DIGITS, '');

  return [...SECRET_WORDS].some(secret => bare.endsWith(secret));
}

/**
 * Does this flag's name say it carries a secret?
 *
 * Read as words, because matching anywhere in the name takes `--author` and `--oauth-callback` for
 * credentials and drops what the failure message was there to report. Adjacent words are joined
 * too, so `--api-key` and `--apiKey` are the same flag, and a leading `no` is the boolean
 * convention rather than a value.
 */
function isSecretFlag(flag: string): boolean {
  const name = FLAG_NAME.exec(flag)?.[1];

  if (!name) return false;

  const words = name.replace(CAMEL_BOUNDARY, '$1-$2').toLowerCase().split('-');

  if (words[0] === 'no') return false;

  const joined = words.slice(0, -1).map((word, index) => word + words[index + 1]);

  return [...words, ...joined].some(isSecretWord);
}

/**
 * The username may be empty, as in `redis://:password@host`, and the password may be absent, as in
 * `https://ghp_token@github.com`, where the one name there is is the credential.
 */
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]*)(:[^\s/@]+)?@/gi;

/**
 * Take the credential out of any connection string in `text`, which an argument list and a captured
 * stderr both routinely carry into an error that is printed, and often logged. The host and
 * database survive, and so does a username a password follows: they are what makes the failure
 * diagnosable, and they are not the secret. A username on its own is taken out, since a token is
 * exactly what gets written there.
 */
function redactSecrets(text: string): string {
  return text.replace(URL_CREDENTIALS, (match, scheme: string, user: string, password?: string) => {
    if (password) return `${scheme}${user}:***@`;

    return user ? `${scheme}***@` : match;
  });
}

/** A secret can start with a single `-`, so only this shape is read as the next flag. */
const LONG_FLAG = /^--[a-z0-9][a-z0-9-]*$/i;

function redactArgs(args: string[]): string[] {
  let valueIsSecret = false;

  return args.map(arg => {
    const isSecretValue = valueIsSecret && !LONG_FLAG.test(arg);
    const [flag, ...value] = arg.split('=');

    valueIsSecret = isSecretFlag(flag) && !value.length;

    if (isSecretValue) return '***';
    if (isSecretFlag(flag) && value.length) return `${flag}=***`;

    return redactSecrets(arg);
  });
}

const formatCommand = (command: string, args: string[]) =>
  `${command} ${redactArgs(args).join(' ')}`.trim();

/**
 * Run a command to completion. stdio is inherited so the child owns the terminal: `forest login`
 * can open a browser, and a package manager's prompts render natively.
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
 * Run a command, capturing its streams separately — a command whose stdout is a machine-readable
 * document writes its progress to stderr, and merging the two corrupts the document. stderr is
 * streamed through `onProgress`, and carried in the error, since piping it means the sub-command's
 * own message never reached the terminal.
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
    // otherwise become replacement characters.
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

function portInUseError(port?: string): Error {
  return port
    ? new Error(`Port ${port} is already in use — free it with \`lsof -ti :${port} | xargs kill\`.`)
    : new Error(
        'A port it needs is already in use — free it with `lsof -ti :<port> | xargs kill`.',
      );
}

const CLOCK_TIME = /\b\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g;

/**
 * The clash, and the port when the message gives one up — which it writes on either side of the
 * word, and need not write at all: node says `address already in use :::3000`, Ruby says `port 3000
 * (Errno::EADDRINUSE)`, and a unix socket names no port.
 */
function readPortClash(text: string): { port?: string } | undefined {
  const line = /^.*EADDRINUSE.*$/m.exec(text);

  if (!line) return undefined;

  const addressed = line[0].replace(CLOCK_TIME, ' ');
  const [, port] = /:(\d{2,5})\b/.exec(addressed) ?? /\bport (\d{2,5})\b/i.exec(addressed) ?? [];

  return { port };
}

function classifyOutput(
  windows: string[],
  readyPattern: RegExp,
): { ready: true } | { clash: { port?: string } } | undefined {
  if (windows.some(window => readyPattern.test(window))) return { ready: true };

  // The first clash, but the first PORT: overlapping windows can cut the line before its number,
  // and the generic message is only right when no window ever carried one.
  const clash = windows.reduce<{ port?: string } | undefined>(
    (found, window) => (found?.port ? found : readPortClash(window) ?? found),
    undefined,
  );

  return clash ? { clash } : undefined;
}

/**
 * A view of one stream that slides rather than grows, `size` wide, stepping by half of it.
 *
 * Bounded, or a chatty process that never announces itself is matched against everything it ever
 * said and exhausts the heap before the timeout can report it. Overlapping, because reads arrive
 * at sizes of the pipe's choosing: windows cut flush against them would put a seam through an
 * announcement, and a server that said it was listening is killed for not having said it.
 */
function scanWindow(size: number) {
  const step = Math.floor(size / 2);
  let buffered = '';

  return {
    read(chunk: string): string[] {
      buffered += chunk;

      const windows: string[] = [];

      while (buffered.length > size) {
        windows.push(buffered.slice(0, size));
        buffered = buffered.slice(step);
      }
      windows.push(buffered);

      return windows;
    },
    clear() {
      buffered = '';
    },
  };
}

/** `g` and `y` make `.test()` stateful, so a caller's `/listening/g` would skip its own match. */
const withoutStatefulFlags = (pattern: RegExp) =>
  new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''));

/**
 * Watch a freshly spawned process until it says it is ready, or until it is clear it never will be.
 * Every rejection also stops the process, whose open pipes would otherwise keep the CLI's event
 * loop alive — an error, and then a prompt that never returns.
 */
function watchStartup(
  child: ChildProcess,
  command: string,
  ready: RegExp,
  timeoutMs: number,
  onChunk: (text: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readyPattern = withoutStatefulFlags(ready);
    // Sharing one window would let a token straddling stdout and stderr match when neither stream
    // ever produced it.
    const windows = { stdout: scanWindow(SCAN_WINDOW), stderr: scanWindow(SCAN_WINDOW) };
    let settled = false;
    let timeout: NodeJS.Timeout;
    let portClash: NodeJS.Timeout | undefined;
    let clashedPort: string | undefined;

    const settle = () => {
      settled = true;
      clearTimeout(timeout);
      clearTimeout(portClash);
      windows.stdout.clear();
      windows.stderr.clear();
    };

    const clashGraceMs = Math.min(PORT_CLASH_GRACE_MS, Math.floor(timeoutMs / 2));

    const fail = (error: Error) => {
      if (settled) return;
      settle();
      stopProcess(child);
      reject(error);
    };

    const onData = (source: 'stdout' | 'stderr') => (text: string) => {
      onChunk(text);
      if (settled) return;

      const verdict = classifyOutput(windows[source].read(text), readyPattern);

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
    // otherwise become replacement characters.
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', onData('stdout'));
    child.stderr?.on('data', onData('stderr'));
    child.on('error', error => fail(error));
    child.on('close', code =>
      fail(
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

  const groupEnded = trackGroup(child);

  let stream = onOutput;
  const mute = () => {
    stream = undefined;
  };

  const readyPromise = watchStartup(child, command, ready, timeoutMs, text => stream?.(text));

  // Without this, a process that dies before being ready produces an unhandled rejection.
  readyPromise.catch(() => undefined);

  const exited = groupEnded.then(() => ({ code: child.exitCode, signal: child.signalCode }));

  return { child, ready: readyPromise, exited, mute };
}
