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
 * KNOWN LIMITATION — Windows. `process.kill(-pid)` does not exist there and `detached` creates no
 * signalable group, so `stopProcess` falls back to signalling the wrapper alone: the server it
 * spawned survives, which is the very bug this module fixes elsewhere. CI is Linux-only and the
 * onboarding is not offered on Windows; if that changes, this needs `taskkill /T /F`.
 */

export type RunOptions = {
  cwd?: string;
  env?: Record<string, string>;
};

export type StartedProcess = {
  child: ChildProcess;
  /** Resolves when the process prints something matching `ready`, rejects on timeout or a taken port. */
  ready: Promise<void>;
  /** Stop streaming output — before handing the terminal to something else, typically. */
  mute: () => void;
};

export type CaptureResult = { stdout: string; stderr: string };

const READY_TIMEOUT_MS = 120_000;

/**
 * Every process we started and have not stopped. Registered so the CLI can take them down with it:
 * a detached child survives its parent by design, and the terminal's Ctrl-C never reaches it (it
 * sits in its own process group), so without this a crash or an interrupt strands a server holding
 * a port the user then has to hunt down with `lsof`.
 */
const running = new Set<ChildProcess>();
let exitHookInstalled = false;

/**
 * Stop a process started by `startProcess`, and everything it spawned.
 *
 * A negative pid signals the whole process group — the only way to reach the server a package
 * manager launched on our behalf. Never throws: stopping something already stopped is a success.
 */
export function stopProcess(child: ChildProcess | undefined, signal: NodeJS.Signals = 'SIGTERM') {
  // `child.killed` is not the state we need: it only records that `child.kill()` was called, and
  // the group path uses `process.kill()`, which never sets it. `exitCode`/`signalCode` are what
  // actually say the process is gone — and they stop us re-signalling a pid the OS may have reused.
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;

  running.delete(child);

  try {
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Already dead — nothing left to stop.
    }
  }
}

function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;

  const stopAll = () => running.forEach(child => stopProcess(child));

  // `exit` covers a normal end and an uncaught throw. The signals cover the terminal, which would
  // otherwise kill this process and leave the group behind. `once` so a second Ctrl-C is never
  // swallowed — the user must always be able to give up.
  process.on('exit', stopAll);
  (['SIGINT', 'SIGTERM', 'SIGHUP'] as const).forEach(signal =>
    process.once(signal, () => {
      stopAll();
      process.exit(signal === 'SIGINT' ? 130 : 143);
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

const formatCommand = (command: string, args: string[]) => `${command} ${args.join(' ')}`.trim();

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

      const detail = (stderr || stdout).trim();
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
    // Only accumulated until `ready` matches, then released. Keeping it would mean re-running the
    // regex over an ever-growing string for the process's whole life — quadratic, on a buffer a
    // long-lived server grows to hundreds of megabytes.
    let scanned = '';
    let settled = false;
    let timeout: NodeJS.Timeout;

    const settle = () => {
      settled = true;
      clearTimeout(timeout);
      scanned = ''; // release the buffer; `onData` keeps streaming but stops scanning
    };

    // A failed start must not leave the process behind: its open pipes would also keep this CLI's
    // event loop alive, so the user would get an error and then a prompt that never returns.
    const fail = (error: Error) => {
      if (settled) return;
      settle();
      stopProcess(child);
      reject(error);
    };

    const onData = (text: string) => {
      stream?.(text);
      if (settled) return;
      scanned += text;

      if (ready.test(scanned)) {
        settle();
        resolve();
      } else if (/EADDRINUSE/.test(scanned)) {
        fail(new Error('Port already in use — free it with `lsof -ti :<port> | xargs kill`.'));
      }
    };

    timeout = setTimeout(
      () => fail(new Error(`Timed out after ${timeoutMs / 1000}s waiting for \`${command}\`.`)),
      timeoutMs,
    );

    // Same reason as `runCapture`, with a sharper consequence: a `ready` pattern straddling a
    // chunk boundary would never match, and the process would be killed on a false timeout.
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', error => fail(error));
    child.on('close', code =>
      fail(new Error(`\`${command}\` stopped before it was ready (exit code ${code}).`)),
    );
  });

  // The rejection is delivered to whoever awaits `ready`. Without this attachment, a process that
  // dies before being ready produces an unhandled rejection and can take the CLI down with it.
  readyPromise.catch(() => undefined);

  return { child, ready: readyPromise, mute };
}
