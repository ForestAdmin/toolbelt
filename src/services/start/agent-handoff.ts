import type { NodeStack } from '../onboarding/detect';
import type { ChildProcess } from 'child_process';

import fs from 'fs';

import { NODE_DATASOURCE, NODE_SERVER_URL_OPTION } from '../onboarding/detect';

export type Tail = {
  child?: ChildProcess;
  /** Forest project name — a label, not necessarily a directory. */
  name: string;
  /** Where the repo lives: the scaffolded dir for standalone/demo, the user's own dir for in-app.
   *  Derived from the FLOW, never from whether a process happens to be running. */
  dir: string;
  stack: string;
  url: string;
  demo?: boolean;
  /** Stops streaming the back-end's logs — they would otherwise be drawn into a full-screen TUI. */
  mute?: () => () => void;
  /** How to start this back-end again. Rails is not started with `npm start`. */
  restart: string;
};

/**
 * The task handed to the coding agent that mounts Forest. On a conflict the new project's secrets
 * are in neither `.env` nor the shell: an agent told otherwise would wire the app to whichever
 * project those hold.
 */
export function mountSeed(
  stack: NodeStack,
  secretsInDotenv: boolean,
  pinsServerUrl: boolean,
): string {
  const secrets = secretsInDotenv
    ? 'FOREST_ENV_SECRET / FOREST_AUTH_SECRET are in .env'
    : "this project's FOREST_ENV_SECRET / FOREST_AUTH_SECRET are not configured yet, so ask me for them rather than reusing the ones already there";

  const server = pinsServerUrl
    ? ` Pass \`${NODE_SERVER_URL_OPTION}\` to createAgent: this project lives on that Forest server, not the default one.`
    : '';

  return (
    `You're in a ${stack.framework} app using ${stack.orm}. @forestadmin/agent and ` +
    `${NODE_DATASOURCE[stack.orm]} are installed, and ${secrets}.${server} ` +
    "Mount the Forest agent in my server, then stop: don't start the server, " +
    '`forest start` boots it once you are done.'
  );
}

/**
 * What the CLI knows and the coding agent would otherwise have to guess — or guess wrong. Two
 * facts earn their place: the back-end is ALREADY running (a fresh agent's first reflex is to
 * boot it, which collides on the port or kills the live one), and nothing is deployed yet, so no
 * role exists and inviting anyone is premature. Everything durable belongs in the skills.
 */
export function agentSeed(intent: 'customise' | 'deploy', tail: Tail): string {
  const situation = [
    `Stack: ${tail.stack}.`,
    `Its back-end is already running on ${tail.url} — it is live, don't start it.`,
    tail.demo
      ? "The records are Forest sample data, not the user's own database."
      : 'Development only: no production environment exists yet, so no role exists either.',
    'The Forest skills and the Forest docs MCP are installed in this repo.',
  ].join(' ');

  const task =
    intent === 'customise'
      ? 'Help me customise my back-office — e.g. add a segment to a collection, a Smart Action, or an approval workflow.'
      : "Deploy it to production, then invite my team — the first deploy is what creates the project's first role, so inviting only works once it has succeeded.";

  return `You're in a Forest project. ${situation} ${task}`;
}

/** Whether `skills:init` ran here at all — regardless of which agent it set up. */
export function hasSkills(dir: string): boolean {
  return fs.existsSync(`${dir}/.forest/skills-manifest.json`);
}

/**
 * Which coding agents `skills:init` actually set up, read back from the manifest it just wrote.
 * We deliberately do not detect them here: the toolbelt already does it, better — from the repo's
 * own marks, and knowing Cursor and OpenCode too — and asking twice makes a flow feel like a form.
 * No manifest means the skills were never installed here.
 */
export function launchableAgents(cwd: string): { bin: string; label: string }[] {
  const labels: Record<string, string> = { claude: 'Claude Code', codex: 'Codex' };
  try {
    const manifest = JSON.parse(fs.readFileSync(`${cwd}/.forest/skills-manifest.json`, 'utf8')) as {
      agents?: string[];
    };

    return (manifest.agents ?? [])
      .filter(agent => labels[agent])
      .map(agent => ({ bin: agent, label: labels[agent] }));
  } catch {
    return [];
  }
}
