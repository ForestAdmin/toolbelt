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
 */

export type RunOptions = {
  cwd?: string;
  env?: Record<string, string>;
};

export type StartedProcess = {
  child: ChildProcess;
  /** Resolves when the process prints something matching `ready`, rejects on timeout or a taken port. */
  ready: Promise<void>;
};

const READY_TIMEOUT_MS = 120_000;

function spawnOptions(options: RunOptions, extra: SpawnOptions = {}): SpawnOptions {
  return {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    ...extra,
  };
}

/**
 * Run a command to completion. stdio is inherited so the child owns the terminal: `forest login`
 * can open a browser, and a package manager's own prompts and progress render natively instead of
 * being buffered into silence.
 *
 * Rejects with the exit code when the command fails — the caller decides whether that is fatal.
 */
export function runStep(command: string, args: string[], options: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, spawnOptions(options, { stdio: 'inherit' }));

    child.on('error', reject);
    child.on('close', code =>
      code === 0
        ? resolve()
        : reject(new Error(`\`${command} ${args.join(' ')}\` exited with code ${code}`)),
    );
  });
}

/** Same, but capturing stdout instead of inheriting it — for commands we need to read back. */
export function runCapture(
  command: string,
  args: string[],
  options: RunOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      command,
      args,
      spawnOptions(options, { stdio: ['inherit', 'pipe', 'pipe'] }),
    );
    let output = '';

    child.stdout?.on('data', chunk => {
      output += chunk.toString();
    });
    child.stderr?.on('data', chunk => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code =>
      code === 0
        ? resolve(output)
        : reject(new Error(`\`${command} ${args.join(' ')}\` exited with code ${code}`)),
    );
  });
}

/**
 * Start a long-running process in the background, streaming its output through `onOutput`, and
 * resolve `ready` once it prints something matching `ready` — for an agent, the line that says its
 * schema reached Forest.
 *
 * `detached` is the important part: it makes the child a process-group leader so `stopAgent` can
 * take the whole tree down. Without it, a package-manager wrapper survives its own `kill`.
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
  const child = spawn(
    command,
    args,
    spawnOptions(options, { stdio: ['ignore', 'pipe', 'pipe'], detached: true }),
  );

  const readyPromise = new Promise<void>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs / 1000}s waiting for \`${command}\`.`)),
      timeoutMs,
    );

    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      onOutput?.(text);

      if (ready.test(output)) {
        clearTimeout(timeout);
        resolve();
      } else if (/EADDRINUSE/.test(output)) {
        clearTimeout(timeout);
        reject(new Error('Port already in use — free it with `lsof -ti :<port> | xargs kill`.'));
      }
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timeout);
      reject(new Error(`\`${command}\` stopped before it was ready (exit code ${code}).`));
    });
  });

  // The rejection is delivered to whoever awaits `ready`. Without this attachment, a process that
  // dies before being ready produces an unhandled rejection and can take the CLI down with it.
  readyPromise.catch(() => undefined);

  return { child, ready: readyPromise };
}

/**
 * Stop a process started by `startProcess`, and everything it spawned.
 *
 * A negative pid signals the whole process group — the only way to reach the server a package
 * manager launched on our behalf. Falls back to signalling the child alone when the group is
 * already gone (or when the process was never detached), and never throws: stopping something
 * that has already stopped is a success, not an error.
 */
export function stopProcess(child: ChildProcess | undefined, signal: NodeJS.Signals = 'SIGTERM') {
  if (!child?.pid || child.killed) return;

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
