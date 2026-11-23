import type { ChildProcess } from 'child_process';

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * The project in the current folder and the agent it runs on this machine, as the commands that
 * work next to a running agent see them. Values from `.env` stay in memory: never printed.
 */

export function readProjectEnv(projectDir: string): Record<string, string> {
  const file = path.join(projectDir, '.env');

  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

/** Where the project's agent listens on this machine. */
export function localAgentUrl(env: Record<string, string>): string {
  return `http://localhost:${env.APPLICATION_PORT || 3310}`;
}

/** Whether something answers there, whatever the status: a stopped agent refuses the connection. */
export async function agentAnswers(agentUrl: string): Promise<boolean> {
  try {
    await fetch(`${agentUrl}/forest`, { signal: AbortSignal.timeout(3000) });

    return true;
  } catch {
    return false;
  }
}

/** Waits for Ctrl+C (then calls `stop`), or for every child to exit on its own. */
export function untilStopped(children: ChildProcess[], stop: () => void): Promise<void> {
  return new Promise<void>(resolve => {
    const onSignal = () => {
      stop();
      resolve();
    };

    // First in line: the CLI's spinner library exits on SIGINT before a later listener runs, and
    // the children, in their own process groups, would outlive it.
    process.prependOnceListener('SIGINT', onSignal);
    process.prependOnceListener('SIGTERM', onSignal);
    children.forEach(child =>
      child.once('exit', () => {
        if (children.every(each => each.exitCode !== null || each.signalCode !== null)) {
          process.removeListener('SIGINT', onSignal);
          process.removeListener('SIGTERM', onSignal);
          resolve();
        }
      }),
    );
  });
}
