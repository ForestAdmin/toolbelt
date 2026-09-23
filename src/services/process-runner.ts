import type { ChildProcess, SpawnOptions } from 'child_process';

import { spawn } from 'child_process';

// `npm start` is a wrapper: the process holding the port is its child. So long-running processes
// get their own process group, and stopping one signals the whole group.
//
// Known limitation: Windows has no signalable process group, so only the wrapper is stopped there
// and the server survives. Supporting it would need `taskkill /T /F`.

export type RunOptions = {
  cwd?: string;
  /** Merged over this process's environment. An `undefined` value removes the variable. */
  env?: NodeJS.ProcessEnv;
};

export type ProcessExit = { code: number | null; signal: NodeJS.Signals | null };

export type StartedProcess = {
  child: ChildProcess;
  ready: Promise<void>;
  /** Resolves, never rejects, once the whole group has ended. The status is the wrapper's own. */
  exited: Promise<ProcessExit>;
  mute: () => void;
};

export type CaptureResult = { stdout: string; stderr: string };

const READY_TIMEOUT_MS = 120_000;

/** Many dev servers report EADDRINUSE, then bind the next port and become ready anyway. */
const PORT_CLASH_RECOVERY_MS = 5_000;

const STOP_GRACE_MS = 2_000;

const EXIT_STOP_GRACE_MS = 500;

const REAP_POLL_MS = 250;

const READY_SCAN_WINDOW = 8192;

const CAN_SIGNAL_GROUPS = process.platform !== 'win32';

const EXIT_CODE_BY_SIGNAL = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 } as const;

const runningGroups = new Set<ChildProcess>();

const pendingKills = new WeakMap<ChildProcess, NodeJS.Timeout>();

const endedGroups = new WeakSet<ChildProcess>();

let exitHookInstalled = false;

function probeGroup(pid: number): boolean {
  try {
    process.kill(-pid, 0);

    return true;
  } catch {
    return false;
  }
}

// POSIX never reuses a pid while a group still carries it as its id, but may reuse it once the
// group is gone. So the first "gone" is final: probing that pid again could hit another process.
function groupAlive(child: ChildProcess): boolean {
  if (!child.pid || endedGroups.has(child)) return false;

  const alive = CAN_SIGNAL_GROUPS
    ? probeGroup(child.pid)
    : child.exitCode === null && child.signalCode === null;

  if (!alive) {
    endedGroups.add(child);
    runningGroups.delete(child);
  }

  return alive;
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  try {
    if (CAN_SIGNAL_GROUPS) process.kill(-(child.pid as number), signal);
    else child.kill(signal);
  } catch {
    // The group is already gone.
  }
}

// Neither `close` nor `exit` means the group has ended, so both only trigger a probe. The poll stays
// referenced: once the pipes are closed it alone keeps the CLI alive for a caller awaiting `exited`.
function trackGroup(child: ChildProcess): Promise<void> {
  if (child.pid) runningGroups.add(child);

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
    });
  });
}

export function stopProcess(
  child: ChildProcess | undefined,
  signal: NodeJS.Signals = 'SIGTERM',
  graceMs: number = STOP_GRACE_MS,
) {
  if (!child?.pid || !groupAlive(child)) return;

  signalGroup(child, signal);
  clearTimeout(pendingKills.get(child));

  if (signal === 'SIGKILL') return;

  const kill = setTimeout(() => {
    if (groupAlive(child)) signalGroup(child, 'SIGKILL');
  }, graceMs);
  kill.unref();
  pendingKills.set(child, kill);
}

export function stopAllProcesses(
  signal: NodeJS.Signals = 'SIGTERM',
  graceMs: number = STOP_GRACE_MS,
) {
  [...runningGroups].forEach(child => stopProcess(child, signal, graceMs));
}

function sleepSync(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stopAllSync() {
  const children = [...runningGroups];
  children.forEach(child => stopProcess(child));

  if (!children.some(groupAlive)) return;

  sleepSync(EXIT_STOP_GRACE_MS);
  children.forEach(child => {
    if (groupAlive(child)) signalGroup(child, 'SIGKILL');
  });
}

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;

  process.on('exit', stopAllSync);
  // `once`, so a second Ctrl-C falls back to Node's default and always exits.
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

const NOT_SECRET_WORDS = new Set(['oauth']);

const FLAG_NAME = /^--?([a-z0-9][a-z0-9_-]*)$/i;

const ENV_ASSIGNMENT_NAME = /^[a-z_][a-z0-9_]*$/i;

const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;

const TRAILING_DIGITS = /\d+$/;

function endsWithSecretWord(word: string): boolean {
  if (NOT_SECRET_WORDS.has(word)) return false;

  const withoutTrailingDigits = word.replace(TRAILING_DIGITS, '');

  return [...SECRET_WORDS].some(secret => withoutTrailingDigits.endsWith(secret));
}

function isSecretName(name: string): boolean {
  const words = name.replace(CAMEL_BOUNDARY, '$1-$2').toLowerCase().split(/[-_]/);
  const isNegatedBoolean = words[0] === 'no';

  if (isNegatedBoolean) return false;

  const adjacentPairs = words.slice(0, -1).map((word, index) => word + words[index + 1]);

  return [...words, ...adjacentPairs].some(endsWithSecretWord);
}

function isSecretFlag(flag: string): boolean {
  const name = FLAG_NAME.exec(flag)?.[1];

  return name ? isSecretName(name) : false;
}

function isSecretAssignment(name: string): boolean {
  return ENV_ASSIGNMENT_NAME.test(name) && isSecretName(name);
}

const URL_USERINFO = /([a-z][a-z0-9+.-]*:\/\/)([^\s/@:]*)(:[^\s/@]+)?@/gi;

function redactUrlCredentials(text: string): string {
  return text.replace(URL_USERINFO, (userinfo, scheme: string, user: string, password?: string) => {
    if (password) return `${scheme}${user}:***@`;
    if (user) return `${scheme}***@`;

    return userinfo;
  });
}

const LONG_FLAG = /^--[a-z0-9][a-z0-9_-]*$/i;

function redactArgs(args: string[]): string[] {
  let previousFlagIsSecret = false;

  return args.map(arg => {
    const isSecretValue = previousFlagIsSecret && !LONG_FLAG.test(arg);
    const [flag, ...value] = arg.split('=');

    previousFlagIsSecret = isSecretFlag(flag) && !value.length;

    if (isSecretValue) return '***';
    if (value.length && (isSecretFlag(flag) || isSecretAssignment(flag))) return `${flag}=***`;

    return redactUrlCredentials(arg);
  });
}

const formatCommand = (command: string, args: string[]) =>
  `${command} ${redactArgs(args).join(' ')}`.trim();

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

      const detail = redactUrlCredentials((stderr || stdout).trim());
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

const NODE_CLASH_PORT = /:(\d{2,5})\b/;

const RUBY_CLASH_PORT = /\bport (\d{2,5})\b/i;

const CLOCK_TIME = /\b\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\b/g;

function readPortClash(text: string): { port?: string } | undefined {
  const line = /^.*EADDRINUSE.*$/m.exec(text);

  if (!line) return undefined;

  const lineWithoutTimestamps = line[0].replace(CLOCK_TIME, ' ');
  const [, port] =
    NODE_CLASH_PORT.exec(lineWithoutTimestamps) ??
    RUBY_CLASH_PORT.exec(lineWithoutTimestamps) ??
    [];

  return { port };
}

function classifyOutput(
  windows: string[],
  readyPattern: RegExp,
): { ready: true } | { clash: { port?: string } } | undefined {
  if (windows.some(window => readyPattern.test(window))) return { ready: true };

  const clashes = windows.map(readPortClash).filter(clash => clash !== undefined);
  const clash = clashes.find(({ port }) => port) ?? clashes[0];

  return clash ? { clash } : undefined;
}

// Bounded so a chatty process cannot exhaust the heap. Windows overlap by half so a line split
// across two reads still appears whole in one of them.
function slidingWindow(size: number) {
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

const withoutStatefulFlags = (pattern: RegExp) =>
  new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''));

function watchStartup(
  child: ChildProcess,
  command: string,
  ready: RegExp,
  timeoutMs: number,
  onChunk: (text: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const readyPattern = withoutStatefulFlags(ready);
    const windowPerStream = {
      stdout: slidingWindow(READY_SCAN_WINDOW),
      stderr: slidingWindow(READY_SCAN_WINDOW),
    };
    let settled = false;
    let timeout: NodeJS.Timeout;
    let portClash: NodeJS.Timeout | undefined;
    let clashedPort: string | undefined;

    const settle = () => {
      settled = true;
      clearTimeout(timeout);
      clearTimeout(portClash);
      windowPerStream.stdout.clear();
      windowPerStream.stderr.clear();
    };

    const clashGraceMs = Math.min(PORT_CLASH_RECOVERY_MS, Math.floor(timeoutMs / 2));

    const stopAndFail = (error: Error) => {
      if (settled) return;
      settle();
      stopProcess(child);
      reject(error);
    };

    const onData = (source: 'stdout' | 'stderr') => (text: string) => {
      onChunk(text);
      if (settled) return;

      const verdict = classifyOutput(windowPerStream[source].read(text), readyPattern);

      if (!verdict) return;

      if ('ready' in verdict) {
        settle();
        resolve();

        return;
      }

      clashedPort = clashedPort ?? verdict.clash.port;
      portClash =
        portClash ?? setTimeout(() => stopAndFail(portInUseError(clashedPort)), clashGraceMs);
    };

    timeout = setTimeout(
      () =>
        stopAndFail(new Error(`Timed out after ${timeoutMs / 1000}s waiting for \`${command}\`.`)),
      timeoutMs,
    );

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', onData('stdout'));
    child.stderr?.on('data', onData('stderr'));
    child.on('error', stopAndFail);
    child.on('close', code =>
      stopAndFail(
        portClash
          ? portInUseError(clashedPort)
          : new Error(`\`${command}\` stopped before it was ready (exit code ${code}).`),
      ),
    );
  });
}

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

  let forwardOutput = onOutput;
  const mute = () => {
    forwardOutput = undefined;
  };

  const readyOrFailed = watchStartup(child, command, ready, timeoutMs, text =>
    forwardOutput?.(text),
  );
  const preventUnhandledRejection = () => undefined;
  readyOrFailed.catch(preventUnhandledRejection);

  const exited = groupEnded.then(() => ({ code: child.exitCode, signal: child.signalCode }));

  return { child, ready: readyOrFailed, exited, mute };
}
