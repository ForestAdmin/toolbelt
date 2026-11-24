import type { ChildProcess } from 'child_process';

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { localAgentUrl, readProjectEnv, untilStopped } from './local-agent';

/**
 * The partner portals of the demo bank: two small apps outside Forest (portals/ in a demo project)
 * that call the project's agent through Forest's Gateway API with a service-account key. This
 * module checks what they need, guides the user to a key, starts the apps and stops them. The key
 * is read from and written to the project's .env only: never printed, never logged.
 */

export type PortalSpec = {
  label: string;
  /** What it shows, in one line. */
  what: string;
  /** Its folder, inside the project. */
  dir: string;
  port: number;
};

export type StepState = 'done' | 'warned' | 'failed';

/** What the flow needs from its host: a screen, a hidden prompt, an Enter key, a browser. */
export type PortalsIO = {
  say(text: string): void;
  /** A check, as the checklist shows it: what it found, and why it matters when it fails. */
  step(state: StepState, label: string, detail?: string, why?: string): void;
  /** What the user does next, one line each; `code` in backticks stands out. */
  panel(title: string, lines: string[]): void;
  /** A yes/no question; false when nobody can answer it (no terminal). */
  confirm(message: string): Promise<boolean>;
  askSecret(message: string): Promise<string>;
  pressEnter(message: string): Promise<void>;
  open(url: string): Promise<void>;
};

/** What Forest says about the project, through the user's `forest login`. */
export type ProjectFacts = {
  id: string;
  name: string;
  /** An active production environment with roles: service accounts need one. */
  hasProduction: boolean;
  /** Once production exists, Development layout edits need a branch. */
  hasBranch: boolean;
  /** The production environment, if one was created, active or not. */
  productionId?: string;
};

export type PortalsOptions = {
  projectDir: string;
  io: PortalsIO;
  /** Asks Forest about the project (needs `forest login`). */
  facts: () => Promise<ProjectFacts>;
  /** Installs @forestadmin/agent-bff at a version, in the project. */
  install: (version: string) => Promise<void>;
  /** Runs one of this CLI's commands in the project folder; resolves its output, never shown. */
  forest: (args: string[]) => Promise<string>;
  /** Starts the project's agent with these settings over its .env, its output to a log. */
  runAgent: (env: Record<string, string>) => { stop(): void; logFile: string };
  /** The apps to start: PORTALS, unless a test picks other ports. */
  portals?: PortalSpec[];
  dryRun?: boolean;
};

export const PORTALS: PortalSpec[] = [
  {
    label: 'Lagoon partner portal',
    what: 'a customer applies for a Lagoon account; the bank gets the case in Forest',
    dir: 'portals/partner-portal',
    port: 3500,
  },
  {
    label: 'Lagoon back office',
    what: "Lagoon's own operators review their cases, Lagoon's only",
    dir: 'portals/lagoon-backoffice',
    port: 3600,
  },
];

export const KEY_NAME = 'FOREST_GATEWAY_KEY';
export const KEY_PREFIX = 'fgw_';
const GATEWAY_PACKAGE = '@forestadmin/agent-bff';
const APP_URL = 'https://app.forestadmin.com';
/** Where the agent answers while it activates Production, next to the Development one. */
const PRODUCTION_PORT = 3311;
const PRODUCTION_EXECUTOR_PORT = 3411;
const WRONG_ENVIRONMENT =
  'A key opens only the environment it was made for, and your agent runs Development.';

/** Sets KEY=value in a .env, replacing its line if there is one, without ever echoing it. */
export function setDotenv(file: string, key: string, value: string): void {
  // Private before the key is in it: a .env that was there may be readable by others, and `mode`
  // applies only to a file it creates.
  if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  // Every line that sets it goes, and one is written: with two, the apps would read the last.
  const sets = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
  const kept = before.split('\n').filter(line => !sets.test(line));
  const rest = kept.join('\n').replace(/\n*$/, '');
  fs.writeFileSync(file, `${rest ? `${rest}\n` : ''}${key}=${value}\n`, { mode: 0o600 });
}

/** Why a pasted key is refused, or null when it looks right. Never quotes the key. */
export function keyProblem(key: string): string | null {
  if (!key) return 'Nothing was pasted.';
  if (/\s/.test(key)) return 'The key has spaces or line breaks in it. Copy it again.';
  if (!key.startsWith(KEY_PREFIX)) {
    return `A Gateway key starts with "${KEY_PREFIX}". This looks like another kind of key.`;
  }

  return null;
}

/**
 * What the running agent says of a key: accepted, refused (made for another environment, or
 * deleted), or unknown when it could not be asked.
 */
export async function keyVerdict(
  agentUrl: string,
  key: string,
): Promise<'accepted' | 'refused' | 'unknown'> {
  try {
    // A route every key may read; the Gateway also wants a timezone on every call.
    const response = await fetch(`${agentUrl}/api/agent/v1/permissions`, {
      headers: { 'X-Forest-Gateway-Key': key, 'X-Forest-Timezone': 'UTC' },
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return 'accepted';

    return response.status === 401 || response.status === 403 ? 'refused' : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function settingsUrl(projectName: string, page: 'service-accounts' | 'roles'): string {
  return `${APP_URL}/${encodeURIComponent(projectName)}/settings/${page}`;
}

/** Where the portals link the cases they open: the demo's Development environment, its team. */
export function forestAppUrl(projectName: string): string {
  return `${APP_URL}/${encodeURIComponent(projectName)}/Development/Operations`;
}

/** What has to exist before a service account can, as the steps that work from the CLI. */
export function productionSteps(facts: ProjectFacts): string[] {
  const steps: string[] = [];

  if (!facts.hasProduction) {
    steps.push(
      'Service accounts need a role, and roles need an active production environment.',
      '',
      `1. \`forest environments:create -n Production -t production -u http://localhost:3311 -p ${facts.id}\``,
      "2. Start the agent once with that environment's secret, on port 3311, until it says",
      '   its schema was sent (`forest environments:get <its id>` shows the secret):',
      '   `FOREST_ENV_SECRET=<production secret> APPLICATION_PORT=3311 npm start`',
      '   Forest then activates the environment and creates its first role.',
    );
  }

  // Production on its own, or already there without a branch: either way, a branch next.
  if (!facts.hasProduction || !facts.hasBranch) {
    const first = facts.hasProduction ? 1 : 3;
    steps.push(
      `${first}. \`forest branch demo --projectId ${facts.id} -o Production\``,
      '   Development layout edits need a branch once production exists.',
      `${
        first + 1
      }. \`forest layout:apply forest-layout.json --with-workflows -e Development -t Operations -f\``,
      "   A new branch can show an empty layout: this puts the demo's back, and changes nothing",
      '   when it is already there.',
    );
  }

  return steps;
}

/** The version of the Gateway package the project's installed agent asks for, if it names one. */
export function expectedGatewayVersion(projectDir: string): string | null {
  const agentPackage = path.join(
    projectDir,
    'node_modules',
    '@forestadmin',
    'agent',
    'package.json',
  );
  if (!fs.existsSync(agentPackage)) return null;
  const { peerDependencies = {} } = JSON.parse(fs.readFileSync(agentPackage, 'utf8'));

  return peerDependencies[GATEWAY_PACKAGE] ?? null;
}

export function installedGatewayVersion(projectDir: string): string | null {
  const file = path.join(projectDir, 'node_modules', '@forestadmin', 'agent-bff', 'package.json');

  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).version : null;
}

export type AgentState = 'gateway' | 'no-gateway' | 'down';

/** Whether the agent answers, and whether it serves the Gateway API (401 without a key). */
export async function agentState(agentUrl: string): Promise<AgentState> {
  try {
    const response = await fetch(`${agentUrl}/api/agent/v1/collections`, {
      signal: AbortSignal.timeout(3000),
    });

    return response.status === 404 ? 'no-gateway' : 'gateway';
  } catch {
    return 'down';
  }
}

async function answers(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) });

    return true;
  } catch {
    return false;
  }
}

async function waitUntilAnswers(port: number, ended: () => boolean, ms = 15000): Promise<boolean> {
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    if (ended()) return false;
    // eslint-disable-next-line no-await-in-loop -- polling is sequential by nature
    if (await answers(port)) return true;
    // eslint-disable-next-line no-await-in-loop -- polling is sequential by nature
    await new Promise(resolve => {
      setTimeout(resolve, 400);
    });
  }

  return false;
}

/** The Gateway package at the agent's version, installed if needed. False: run it again later. */
async function ensureGatewayPackage(options: PortalsOptions): Promise<boolean> {
  const { io, projectDir } = options;
  const label = 'Gateway package';
  const expected = expectedGatewayVersion(projectDir);

  if (!expected) {
    io.step('failed', label, "this project's agent isn't installed", 'Run npm install here first.');

    return false;
  }

  if (installedGatewayVersion(projectDir) === expected) {
    io.step('done', label, `${GATEWAY_PACKAGE} ${expected}`);

    return true;
  }

  const install = `npm install ${GATEWAY_PACKAGE}@${expected} --save-exact`;
  if (options.dryRun) {
    io.step('warned', label, `${GATEWAY_PACKAGE} ${expected} to install`);
    io.say(`  ${install} (dry-run)`);

    return false;
  }

  io.step('warned', label, `installing ${GATEWAY_PACKAGE} ${expected}`);
  await options.install(expected);
  io.step(
    'done',
    label,
    `${GATEWAY_PACKAGE} ${expected} installed`,
    'The exact version your agent expects: the Gateway runs inside the agent.',
  );
  io.panel('Next', [
    '1. Restart your agent: Ctrl+C in its window, then `npm start`.',
    '   It turns the Gateway on as it starts.',
    '2. Run `forest portals` again.',
  ]);

  return false;
}

/** The project's .env, or null (after saying why) when the flow cannot go on. */
async function checkProject(options: PortalsOptions): Promise<Record<string, string> | null> {
  const { io, projectDir } = options;
  const env = readProjectEnv(projectDir);

  if (!env.FOREST_ENV_SECRET) {
    io.step('failed', 'Demo project', 'no Forest project here', 'Run it in your demo folder.');

    return null;
  }

  if (!fs.existsSync(path.join(projectDir, PORTALS[0].dir, 'server.js'))) {
    io.step(
      'failed',
      'Demo project',
      'no portals in this project',
      'They come with the demo project that forest start creates.',
    );

    return null;
  }

  io.step('done', 'Demo project', path.basename(projectDir));
  if (!(await ensureGatewayPackage(options))) return null;

  const agentUrl = localAgentUrl(env);
  const state = await agentState(agentUrl);

  if (state === 'down') {
    io.step('failed', 'Agent', `not answering on ${agentUrl}`);
    io.panel('Next', [
      '1. Start it in another Terminal window, in this folder: `npm start`.',
      '2. Run `forest portals` again.',
    ]);

    return null;
  }

  if (state === 'no-gateway') {
    io.step(
      'failed',
      'Agent',
      `runs without the Gateway, on ${agentUrl}`,
      'It started before the Gateway package was installed.',
    );
    io.panel('Next', [
      '1. Restart it: Ctrl+C in its window, then `npm start`.',
      '2. Run `forest portals` again.',
    ]);

    return null;
  }

  io.step('done', 'Agent', `${agentUrl}, Gateway on`);

  return env;
}

/** Up to three hidden pastes; one the agent accepts goes to the .env, never on screen. */
async function pasteKey(options: PortalsOptions, agentUrl: string): Promise<boolean> {
  const { io } = options;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop -- one prompt at a time
    const key = await io.askSecret(`Paste the key (hidden, ${KEY_PREFIX}…)`).then(
      pasted => pasted.trim(),
      error => {
        io.step('failed', 'Gateway key', `not pasted: ${(error as Error).message}`);

        return null;
      },
    );
    if (key === null) return false;

    const problem = keyProblem(key);
    // eslint-disable-next-line no-await-in-loop -- one check per paste
    const verdict = problem ? null : await keyVerdict(agentUrl, key);

    if (problem) {
      io.step('failed', 'Gateway key', problem);
    } else if (verdict === 'refused') {
      io.step('failed', 'Gateway key', 'refused by your agent', WRONG_ENVIRONMENT);
      io.say('  Generate one for Development on the same account, then paste it.');
    } else {
      setDotenv(path.join(options.projectDir, '.env'), KEY_NAME, key);
      io.step(
        'done',
        'Gateway key',
        verdict === 'accepted'
          ? 'accepted by your agent, saved in .env'
          : 'saved in .env (your agent could not check it)',
      );

      return true;
    }
  }

  return false;
}

async function poll<T>(
  probe: () => Promise<T | null>,
  ms: number,
  every = 3000,
): Promise<T | null> {
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop -- polling is sequential by nature
    const value = await probe();
    if (value) return value;
    // eslint-disable-next-line no-await-in-loop -- polling is sequential by nature
    await new Promise(resolve => {
      setTimeout(resolve, every);
    });
  }

  return null;
}

/**
 * Production, created or given its address, then activated: Forest activates an environment once
 * an agent answers at its address with its secret, so the project's agent starts once there, next
 * to the Development one, until Forest says so. The secret stays in memory.
 */
async function activateProduction(options: PortalsOptions, facts: ProjectFacts): Promise<void> {
  const { io } = options;
  const url = `http://localhost:${PRODUCTION_PORT}`;
  let id = facts.productionId;

  if (id) {
    await options.forest(['environments:update', '-e', id, '-u', url]);
  } else {
    const created = await options.forest([
      ...['environments:create', '-n', 'Production', '-t', 'production'],
      ...['-u', url, '-p', facts.id, '--format', 'json'],
    ]);
    id = String(JSON.parse(created).id);
  }
  io.step('done', 'Production', `environment ${id}, at ${url}`);

  const { secretKey } = JSON.parse(
    await options.forest(['environments:get', id, '--format', 'json']),
  );
  const agent = options.runAgent({
    FOREST_ENV_SECRET: secretKey,
    APPLICATION_PORT: String(PRODUCTION_PORT),
    WORKFLOW_EXECUTOR_PORT: String(PRODUCTION_EXECUTOR_PORT),
  });

  try {
    const active = await poll(async () => (await options.facts()).hasProduction || null, 120000);
    if (!active) throw new Error(`Forest did not activate it. The agent's log: ${agent.logFile}`);
  } finally {
    agent.stop();
  }
  io.step('done', 'Production', 'active, with its first role');
}

/**
 * What a service account needs, after a yes: an active production environment, then a branch for
 * Development and the demo's layout on it. Resolves the project as Forest then sees it, or null
 * (with the steps to do by hand) when it was declined or failed.
 */
async function setUpProduction(
  options: PortalsOptions,
  facts: ProjectFacts,
): Promise<ProjectFacts | null> {
  const { io } = options;
  const todo = [
    ...(facts.hasProduction
      ? []
      : [`Create Production and activate it: your agent starts once on port ${PRODUCTION_PORT}.`]),
    'Make a branch for Development, as Forest asks once production exists.',
    "Apply the demo's layout to that branch.",
  ];

  io.step(
    'warned',
    'Production',
    facts.hasProduction ? 'active, no branch yet' : 'not active yet',
    'A Gateway key belongs to a service account, whose role needs an active production environment.',
  );
  io.panel(
    'forest portals can set it up now, in about a minute',
    todo.map((line, index) => `${index + 1}. ${line}`),
  );

  if (options.dryRun || !(await io.confirm('Set it up now?'))) {
    io.panel('Or by hand, in this folder', productionSteps(facts));
    io.say('  Then run `forest portals` again.');

    return null;
  }

  try {
    if (!facts.hasProduction) await activateProduction(options, facts);
    await options.forest(['branch', 'demo', '--projectId', facts.id, '-o', 'Production']);
    io.step('done', 'Branch', 'demo, for Development');
    // A new branch can show an empty layout: this puts the demo's back, and changes nothing else.
    await options.forest([
      ...['layout:apply', 'forest-layout.json', '--with-workflows'],
      ...['-e', 'Development', '-t', 'Operations', '-f'],
    ]);
    io.step('done', 'Layout', "the demo's, on the branch");
  } catch (error) {
    const [reason] = (error as Error).message.split('\n');
    io.step('failed', 'Production', reason);
    // With Production and its branch there, what is left is the demo's layout on the branch: the
    // next runs find nothing to set up, so it is said here.
    const left = productionSteps(await options.facts());
    io.panel(
      'To finish by hand, in this folder',
      left.length
        ? left
        : [
            '1. `forest layout:apply forest-layout.json --with-workflows -e Development -t Operations -f`',
            "   The demo's layout and workflows, on the branch.",
          ],
    );

    return null;
  }

  return options.facts();
}

/** Guides the user to a key. False when they cannot go on yet. */
async function obtainKey(options: PortalsOptions, facts: ProjectFacts, agentUrl: string) {
  const { io } = options;

  const ready =
    facts.hasProduction && facts.hasBranch ? facts : await setUpProduction(options, facts);
  if (!ready) return false;

  const url = settingsUrl(ready.name, 'service-accounts');
  io.panel('In Forest, in your browser', [
    '1. Service accounts: open yours, or create one on the Operations team, with its role.',
    '2. On that account: Generate application token, environment `Development`.',
    `3. Copy the key (${KEY_PREFIX}…): Forest shows it once. Then come back here.`,
  ]);
  await io.pressEnter(`Press Enter to open ${url}`);

  if (options.dryRun) {
    io.say(`  open ${url} (dry-run)`);
    io.say(`  (dry-run: the key would be asked for, hidden, and saved in .env as ${KEY_NAME})`);

    return false;
  }

  await io.open(url);

  return pasteKey(options, agentUrl);
}

/** A key the agent opens to: the one in .env, or a new one. False when there is none yet. */
async function ensureKey(
  options: PortalsOptions,
  env: Record<string, string>,
  facts: ProjectFacts,
): Promise<boolean> {
  const { io } = options;
  const agentUrl = localAgentUrl(env);
  const saved = env[KEY_NAME];

  if (!saved) {
    io.step(
      'warned',
      'Gateway key',
      'none in .env',
      'The portals call your agent with a service account key, made in Forest.',
    );

    return obtainKey(options, facts, agentUrl);
  }

  const verdict = await keyVerdict(agentUrl, saved);
  if (verdict === 'accepted') {
    io.step('done', 'Gateway key', 'in .env, accepted by your agent');

    return true;
  }
  if (verdict === 'unknown') {
    io.step('warned', 'Gateway key', 'in .env, not checked: your agent did not answer');

    return true;
  }

  io.step('failed', 'Gateway key', 'the one in .env is refused by your agent', WRONG_ENVIRONMENT);

  return obtainKey(options, facts, agentUrl);
}

/**
 * Whether every app's port is free. Whatever answers there is not taken for a portal of this
 * project: it can be one of another project, still running with that project's key.
 */
async function portsFree(portals: PortalSpec[], io: PortalsIO): Promise<boolean> {
  const taken = (
    await Promise.all(portals.map(async spec => ((await answers(spec.port)) ? spec : null)))
  ).filter((spec): spec is PortalSpec => spec !== null);

  taken.forEach(spec =>
    io.step(
      'failed',
      spec.label,
      `port ${spec.port} is taken`,
      "Portals from another run, or another project's, may still be up, with another key.",
    ),
  );
  if (taken.length) {
    io.panel('Next', [
      ...taken.map(
        (spec, index) =>
          `${index + 1}. See what holds it: \`lsof -nP -iTCP:${
            spec.port
          } -sTCP:LISTEN\`, then stop it.`,
      ),
      `${taken.length + 1}. Run \`forest portals\` again.`,
    ]);
  }

  return !taken.length;
}

/**
 * This process's environment for the apps, without what makes them a hosted copy: a PUBLIC_URL
 * left in the user's shell (other tools use the name) would open them to the network.
 */
function localEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.PUBLIC_URL;
  delete env.DEMO_PASSWORD;

  return env;
}

/** Starts one app. Resolves whether it answers. */
async function startApp(
  spec: PortalSpec,
  options: PortalsOptions,
  run: { appUrl: string; log: number; logFile: string; children: ChildProcess[] },
): Promise<boolean> {
  const { io } = options;
  const url = `http://localhost:${spec.port}`;

  if (options.dryRun) {
    io.say(`  node ${spec.dir}/server.js .env ${spec.port} (dry-run)`);

    return false;
  }

  const child = spawn(
    process.execPath,
    ['server.js', path.join(options.projectDir, '.env'), String(spec.port)],
    {
      cwd: path.join(options.projectDir, spec.dir),
      env: { ...localEnv(), FOREST_APP_URL: run.appUrl },
      stdio: ['ignore', run.log, run.log],
    },
  );
  run.children.push(child);
  // A spawn that fails (its folder gone) emits an error, never an exit: a failed start too.
  let failed = false;
  child.once('error', () => {
    failed = true;
  });

  if (await waitUntilAnswers(spec.port, () => failed || child.exitCode !== null)) {
    io.step('done', spec.label, url, spec.what);

    return true;
  }

  io.step('failed', spec.label, `didn't start, its log: ${run.logFile}`);

  return false;
}

/** The whole flow: the project, then the key, then the apps. Resolves once they are stopped. */
export async function runPortals(options: PortalsOptions): Promise<void> {
  const { io } = options;
  const env = await checkProject(options);
  if (!env) return;

  let facts: ProjectFacts;
  try {
    facts = await options.facts();
  } catch (error) {
    io.step('failed', 'Forest', `could not read the project (${(error as Error).message})`);
    io.panel('Next', ['1. `forest login`', '2. Run `forest portals` again.']);

    return;
  }
  io.step('done', 'Forest', `project ${facts.name}`);

  if (!(await ensureKey(options, env, facts))) return;

  // The apps' log can name the project: its user's only, the temp folder is shared on Linux.
  // In a folder of its own: a predictable name in a temp folder every user shares (Linux) could
  // be someone else's file.
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forest-portals-')), 'apps.log');
  const run = {
    appUrl: forestAppUrl(facts.name),
    log: fs.openSync(logFile, 'a', 0o600),
    logFile,
    children: [] as ChildProcess[],
  };
  const portals = options.portals ?? PORTALS;
  if (!(await portsFree(portals, io))) return;

  // One app after the other: their first lines in the log stay apart.
  const up = await portals.reduce<Promise<PortalSpec[]>>(async (previous, spec) => {
    const started = await previous;

    return (await startApp(spec, options, run)) ? [...started, spec] : started;
  }, Promise.resolve([]));

  const stop = () => run.children.forEach(child => child.exitCode === null && child.kill());
  if (!up.length) {
    stop();

    return;
  }

  // A browser that does not open leaves the apps running all the same, stopped as usual.
  await io.open(`http://localhost:${up[0].port}`).catch(() => {
    io.say(`  Open http://localhost:${up[0].port} in your browser.`);
  });

  io.say(`\n  Ctrl+C stops them. Logs: ${logFile}`);
  await untilStopped(run.children, stop);
}
