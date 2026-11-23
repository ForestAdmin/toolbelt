import type { ChildProcess } from 'child_process';

import dotenv from 'dotenv';
import fs from 'fs';
import net from 'net';
import path from 'path';

/**
 * The project in the current folder and the agent it runs on this machine, as the commands that
 * work next to a running agent see them. Values from `.env` stay in memory: never printed.
 */

export function readProjectEnv(projectDir: string): Record<string, string> {
  const file = path.join(projectDir, '.env');

  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
}

/** Where the project's agent listens on this machine: the CLI's APPLICATION_PORT, else an app's PORT. */
export function localAgentUrl(env: Record<string, string>): string {
  return `http://localhost:${env.APPLICATION_PORT || env.PORT || 3310}`;
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

/** Whether anything listens on this port, IPv4 or IPv6, whatever it would answer. */
export async function portTaken(port: number): Promise<boolean> {
  const connects = (host: string) =>
    new Promise<boolean>(resolve => {
      const socket = net.connect({ host, port });
      socket.setTimeout(1000);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => resolve(false));
    });

  return (await Promise.all(['127.0.0.1', '::1'].map(connects))).some(Boolean);
}

/**
 * Waits for Ctrl+C, or for one child to end: either way `stop` ends the others, since each needs
 * the rest (a tunnel left without its server would reach whatever takes its port next). A child
 * that ended before the wait counts too.
 */
export function untilStopped(children: ChildProcess[], stop: () => void): Promise<void> {
  return new Promise<void>(resolve => {
    const done = () => {
      process.removeListener('SIGINT', done);
      process.removeListener('SIGTERM', done);
      stop();
      resolve();
    };
    const ended = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null;

    // First in line: the CLI's spinner library exits on SIGINT before a later listener runs, and
    // the children, in their own process groups, would outlive it.
    process.prependOnceListener('SIGINT', done);
    process.prependOnceListener('SIGTERM', done);
    if (children.some(ended)) done();
    else children.forEach(child => child.once('exit', done));
  });
}
