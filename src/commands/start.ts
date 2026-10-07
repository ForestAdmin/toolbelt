import type { NodeStack, SqlDriver } from '../services/onboarding/detect';
import type { SecretsWrite } from '../services/onboarding/env-file';
import type { ExistingProject } from '../services/onboarding/existing-project';
import type { ChildProcess } from 'child_process';

import { Flags } from '@oclif/core';
import fs from 'fs';
import path from 'path';

import AbstractCommand from '../abstract-command';
import {
  NODE_DATASOURCE,
  SQL_DATASOURCE,
  SQL_DRIVER_NAMES,
  detectNodeStack,
  detectRails,
  mountHelper,
  sqlDriver,
} from '../services/onboarding/detect';
import { bootSecrets, keysLoadedFromDotenv, writeSecrets } from '../services/onboarding/env-file';
import { findForestProject, findForestProjectsIn } from '../services/onboarding/existing-project';
import { START_STEP_ENV } from '../services/onboarding/step';
import {
  INTERRUPTED_EXIT_CODE,
  runCapture,
  runStep,
  startProcess,
  stopAllProcesses,
  stopProcess,
} from '../services/process-runner';
import ProjectManager from '../services/project-manager';

const DOCS_URL = 'https://docs.forest.app';
const DEMO_PORT = 3310;
const RAILS_PORT = 3002;
const NODE_PORT = 3001;

/** The menu entry that ends `forest start` with the back-end running in the foreground. */
const KEEP_RUNNING = 'Keep the back-end running here (Ctrl-C to stop)';

/** How many back-end lines are kept while a question is on screen; older ones are dropped. */
const HELD_LINES = 200;

/** Marks each `forest` command run here as one step, so none of them announces the setup done. */
const STEP_ENV = { [START_STEP_ENV]: '1' };

/** What configures this CLI rather than a project: where its token lives, which server it calls. */
const CLI_SETTINGS = [
  'TOKEN_PATH',
  'FOREST_URL',
  'FOREST_SERVER_URL',
  'NODE_TLS_REJECT_UNAUTHORIZED',
  'SILENT',
];

// What `@forestadmin/agent` logs from `start()`, once its schema reached Forest. Neither "Listening
// on http", which an app with nothing mounted prints too, nor "Successfully mounted on", which the
// framework mounts log before `start()` has run, and so before it can fail.
const READY = /schema was (updated|not updated)/i;

// What `forest_admin_rails` logs when its schema never reached Forest. It boots anyway — the app
// serves, `/forest` answers — so nothing else in the flow can tell that the panel will be empty.
const SCHEMA_SYNC_FAILED = /schema sync failed/i;

type Flow = 'demo' | 'standalone' | 'inapp';

/** A project found on this machine, with its name on the account it belongs to. */
type Reopenable = ExistingProject & { name: string };
type Tail = {
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
 * `forest start` — the whole onboarding, from an empty terminal to a running back-office.
 *
 * A deterministic orchestrator over this CLI's own commands. It prints every command before
 * running it, on purpose: the wrapper stays legible instead of magical, and the developer learns
 * the toolbelt while it works for them.
 *
 * FOUR FLOWS (shared head: log in → pick how you run Forest):
 *   1. Demo data      create:demo   → boot → layout:apply → TRAMPOLINE (connect real data)
 *   2. Standalone     create:sql    → boot                → HANDOFF
 *   3. In-app Rails   create:in-app → gems → generator → boot → HANDOFF
 *   4. In-app Node    create:in-app → install → mount → boot   → HANDOFF
 *
 * Two tails, both interactive loops over a live back-end — never a dead-end wall of text. Neither
 * invites teammates: the first production deploy is what creates the project's first role, so an
 * invite before it lands nowhere.
 */
export default class StartCommand extends AbstractCommand {
  static override description =
    'Set up Forest from scratch: log in, create a project, boot its back-end, and hand your coding agent the skills to build on it.';

  static override flags = {
    'dry-run': Flags.boolean({
      description: 'Print every command instead of running it — to review the flow.',
      default: false,
    }),
    flow: Flags.string({
      description: 'Skip the first question. Without it, a non-interactive run defaults to demo.',
      options: ['demo', 'standalone', 'inapp'],
    }),
    stack: Flags.string({ description: 'In-app stack.', options: ['rails', 'node'] }),
    name: Flags.string({ description: 'Project name (skips the prompt).' }),
    db: Flags.string({ description: 'Database connection URL (skips the database prompts).' }),
    schema: Flags.string({ description: 'Database schema, with --db (default: public).' }),
    mount: Flags.string({
      description: 'How to mount Forest in a Node app.',
      options: ['ai', 'manual', 'standalone'],
    }),
  };

  private dryRun = false;

  /** Back-end output held while a question is on screen, or null when none is. */
  private heldOutput: string[] | null = null;

  // eslint-disable-next-line class-methods-use-this -- reads the ambient TTY, not instance state
  private get interactive(): boolean {
    return Boolean(process.stdin.isTTY);
  }

  /** `skills:init` ships separately: a menu entry calling a command this CLI lacks kills the flow. */
  private get canInstallSkills(): boolean {
    try {
      return Boolean(this.config.findCommand('skills:init'));
    } catch {
      return false;
    }
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(StartCommand);
    this.dryRun = flags['dry-run'];

    // Refused before `login`, since every flow creates a project server-side before its first
    // spawn: `npm` is `npm.cmd` there, and a back-end cannot be stopped without a process group.
    if (process.platform === 'win32' && !this.dryRun) {
      throw new Error(
        `\`forest start\` does not run on Windows yet. Use WSL, or follow ${DOCS_URL} by hand.`,
      );
    }

    // Loaded into this process at startup, and inherited by every child otherwise: a `forest`
    // command run in a demo would then target the project of the `.env` it was started next to,
    // and an app would read dotenv 8's parse ahead of its own. The CLI's own settings stay, since
    // a child running in a scaffold reads a `.env` that does not carry them.
    keysLoadedFromDotenv()
      .filter(key => !CLI_SETTINGS.includes(key))
      .forEach(key => delete process.env[key]);

    try {
      await this.onboard(flags as Record<string, string | undefined>);
    } catch (error) {
      // Anything after a boot — `layout:apply`, a readiness timeout — can fail. The back-end is
      // detached, so it would survive, and its open pipes can keep this command alive with it: an
      // error message followed by a prompt that never returns, and a port still held.
      stopAllProcesses();

      throw error;
    }
  }

  private async onboard(flags: Record<string, string | undefined>): Promise<void> {
    this.logger.log(
      `\nWelcome to ${this.chalk.green('Forest')}. Let's get your back-office running.`,
    );

    // A session still valid here is the one every step below reads, from the same TOKEN_PATH:
    // sending the user through the browser device flow again would only cost them a code.
    if (this.context.authenticator.getAuthToken()) {
      this.logger.log(this.chalk.grey('  (already logged in — skipping `forest login`)'));
    } else {
      await this.forest(['login']); // OIDC device flow (browser signup/login)
    }

    // Reopening is offered only to someone who can answer, and who did not already say what to do.
    const lookAround = this.interactive && !flags.flow;

    const here = lookAround ? await StartCommand.reopenable(findForestProject('.')) : null;
    if (here && (await this.chooseToReopen(here))) return this.reopen(here);

    const nearby =
      lookAround && !here ? await StartCommand.reopenables(findForestProjectsIn('.')) : [];
    const flow = await this.pickFlow(flags.flow as Flow | undefined, nearby.length);

    if (flow === 'reopen') return this.reopen(await this.pickNearby(nearby));
    if (flow === 'demo') return this.flowDemo();
    if (flow === 'standalone') return this.flowStandalone(flags);

    const stack = await this.pickStack(flags.stack as 'rails' | 'node' | undefined);

    return stack === 'rails' ? this.flowInAppRails(flags) : this.flowInAppNode(flags);
  }

  // ---------- primitives ----------

  /**
   * Values that must never reach the terminal, a scrollback or a CI log. The echo is a feature —
   * it teaches what the wrapper does — but a database URL carries credentials and an env secret is
   * a long-lived one, so what is shown and what is run are not the same string.
   */
  private static isHidden(command: string, args: string[], index: number): boolean {
    const previous = args[index - 1];

    return (
      previous === '--databaseConnectionURL' ||
      previous === '-c' ||
      (command === 'bin/rails' && previous === 'forest_admin_rails:install')
    );
  }

  private static redact(command: string, args: string[]): string {
    const shown = args.map((arg, index) =>
      StartCommand.isHidden(command, args, index) ? '<redacted>' : arg,
    );

    return `${command} ${shown.join(' ')}`.trim();
  }

  /**
   * The same values, out of a failure's message. The runner only knows secret-named flags and URL
   * userinfo, so a bare positional or a URL's `?password=` would otherwise print in the clear.
   */
  private static scrubbed(error: unknown, command: string, args: string[]): Error {
    const hidden = args.filter((_, index) => StartCommand.isHidden(command, args, index));

    return new Error(
      hidden.reduce(
        (message, value) => message.split(value).join('<redacted>'),
        (error as Error).message,
      ),
    );
  }

  /** Run a command, echoing it first. The echo is the point: it teaches what the wrapper does. */
  private async run$(command: string, args: string[], cwd?: string): Promise<void> {
    this.logger.log(this.chalk.grey(`\n$ ${StartCommand.redact(command, args)}`));
    if (this.dryRun) return this.logger.log(this.chalk.grey('  (dry-run — not executed)'));

    return this.holdingOutput(() =>
      runStep(command, args, { cwd }).catch(error => {
        throw StartCommand.scrubbed(error, command, args);
      }),
    );
  }

  /** Invoke one of our own commands. Resolved through this executable, never through the PATH:
   *  under `npx forest-cli@latest start` there may be no `forest` installed anywhere. */
  private forest(args: string[], cwd?: string): Promise<void> {
    this.logger.log(this.chalk.grey(`\n$ ${StartCommand.redact('forest', args)}`));
    if (this.dryRun) {
      this.logger.log(this.chalk.grey('  (dry-run — not executed)'));

      return Promise.resolve();
    }

    return this.holdingOutput(() =>
      runStep(process.execPath, [process.argv[1], ...args], { cwd, env: STEP_ENV }).catch(error => {
        // Ctrl-C in one of its prompts: the user stopped the setup, not a failure to report.
        if (error.exitCode === INTERRUPTED_EXIT_CODE) this.exit(INTERRUPTED_EXIT_CODE);
        throw StartCommand.scrubbed(error, 'forest', args);
      }),
    );
  }

  /**
   * Invoke one of our own commands and read its stdout back. `--format json` is only understood by
   * newer CLIs, so a rejection mentioning it is retried without: the flow must not die on a flag.
   * stderr is streamed rather than swallowed — this command prints the secrets and the next steps
   * there, and a silent terminal during project creation reads as a hang.
   */
  private async forestCapture(args: string[]): Promise<string> {
    this.logger.log(this.chalk.grey(`\n$ ${StartCommand.redact('forest', args)}`));
    if (this.dryRun) {
      this.logger.log(this.chalk.grey('  (dry-run — not executed)'));

      return '';
    }

    const onProgress = (chunk: string) =>
      this.logger.log(this.chalk.grey(chunk.replace(/\n$/, '')));

    try {
      const { stdout } = await runCapture(process.execPath, [process.argv[1], ...args], {
        onProgress,
        env: STEP_ENV,
      });

      return stdout;
    } catch (error) {
      // The error message opens with the command, which contains `--format` — testing the whole
      // message would match every failure and re-run a command that creates a project.
      // Only the diagnostic below the first line can say the flag is unknown.
      const [, ...detail] = (error as Error).message.split('\n');
      if (!args.includes('--format') || !/Nonexistent flag/i.test(detail.join('\n'))) throw error;

      const withoutFormat = args.filter(
        (arg, index) => arg !== '--format' && args[index - 1] !== '--format',
      );
      this.logger.log(
        this.chalk.grey('  (this CLI has no --format json — reading the printed secrets)'),
      );
      // NO onProgress here, unlike above: this retry captures the human output precisely because
      // that is where the secrets are printed. Echoing it would put a long-lived credential in
      // the terminal, the scrollback and — on the non-interactive path — a retained CI log.
      const { stdout, stderr } = await runCapture(
        process.execPath,
        [process.argv[1], ...withoutFormat],
        { env: STEP_ENV },
      );

      return `${stdout}\n${stderr}`;
    }
  }

  /** Boot a back-end, streaming its logs, and wait until its schema reached Forest. */
  private boot(
    command: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; ready?: RegExp; trouble?: RegExp } = {},
  ) {
    // A boot can succeed and still not deliver what the flow promised. `trouble` is the line that
    // says so, read off the same stream `ready` watches, so the caller can report what happened
    // instead of the tail it would have printed. Non-global on purpose: `test()` on a /g regex
    // carries `lastIndex` between chunks and would start missing matches.
    let troubled = false;
    const started = startProcess(command, args, {
      ready: options.ready ?? READY,
      cwd: options.cwd,
      env: options.env,
      onOutput: chunk => {
        if (options.trouble?.test(chunk)) troubled = true;
        const line = this.chalk.grey(`  | ${chunk.replace(/\n$/, '')}`);
        if (!this.heldOutput) this.logger.log(line);
        // Bounded: a menu can stay open for hours over a chatty back-end.
        else if (this.heldOutput.push(line) > HELD_LINES) this.heldOutput.shift();
      },
    });

    return Object.assign(started, { troubled: () => troubled });
  }

  /**
   * Hold a running back-end's logs while something else owns the terminal: a question here, or a
   * command run in the foreground, which may ask its own (`skills:init` does). inquirer redraws a
   * menu by erasing the lines it drew, so a log line printed meanwhile — a request, as soon as the
   * user opens the back-office — gets erased instead, and the menu is drawn again below its old
   * copy. The held lines are printed once it is done.
   */
  private async holdingOutput<T>(run: () => Promise<T>): Promise<T> {
    if (this.heldOutput) return run();

    this.heldOutput = [];
    try {
      return await run();
    } finally {
      const held = this.heldOutput;
      this.heldOutput = null;
      held.forEach(line => this.logger.log(line));
    }
  }

  // The answers stay loosely typed, as `inquirer.prompt` returns them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ask(question: Record<string, unknown>): Promise<any> {
    return this.holdingOutput(() => this.context.inquirer.prompt([question]));
  }

  private async confirm(message: string): Promise<boolean> {
    return (await this.ask({ type: 'confirm', name: 'value', message, default: true })).value;
  }

  private instruct(title: string, lines: string[]): void {
    this.logger.log(`\n${this.chalk.bold(title)}`);
    lines.forEach(line => this.logger.log(`  ${line}`));
  }

  // ---------- questions ----------

  private async pickFlow(fromFlag?: Flow, nearby = 0): Promise<Flow | 'reopen'> {
    if (fromFlag) return fromFlag;
    if (!this.interactive) {
      this.logger.log(this.chalk.grey('  (non-interactive — defaulting to demo data)'));

      return 'demo';
    }

    const { flow } = await this.ask({
      type: 'list',
      name: 'flow',
      message: 'How will you run Forest?',
      choices: [
        { name: 'Try it with demo data', value: 'demo' },
        { name: 'Standalone — dedicated server on my database (recommended)', value: 'standalone' },
        { name: 'In-app — add Forest to my existing app', value: 'inapp' },
        ...(nearby
          ? [
              {
                name: `Reopen a project in this folder (${nearby} found)`,
                value: 'reopen',
              },
            ]
          : []),
      ],
    });

    return flow;
  }

  // ---------- reopening ----------

  /**
   * A project found on disk, named after the account's record of it. Null when the account does not
   * know its secret — deleted, or another account's: booting it would only fail on "Not found".
   */
  private static async reopenable(project: ExistingProject | null): Promise<Reopenable | null> {
    if (!project) return null;

    try {
      const found = await new ProjectManager({}).getByEnvSecret(project.envSecret);

      return found?.name ? { ...project, name: found.name } : null;
    } catch {
      return null;
    }
  }

  private static async reopenables(projects: ExistingProject[]): Promise<Reopenable[]> {
    const named = await Promise.all(projects.map(project => StartCommand.reopenable(project)));

    return named.filter((project): project is Reopenable => project !== null);
  }

  private async chooseToReopen(project: Reopenable): Promise<boolean> {
    const { next } = await this.ask({
      type: 'list',
      name: 'next',
      message: `This folder is the Forest project "${project.name}". What do you want to do?`,
      choices: [
        { name: `Start it — boot its back-end and pick up from there`, value: 'reopen' },
        { name: 'Create a new project', value: 'new' },
      ],
    });

    return next === 'reopen';
  }

  private async pickNearby(projects: Reopenable[]): Promise<Reopenable> {
    if (projects.length === 1) return projects[0];

    const { project } = await this.ask({
      type: 'list',
      name: 'project',
      message: 'Which one?',
      choices: projects.map(candidate => ({
        name: `${candidate.name}  ${this.chalk.grey(`./${candidate.dir}`)}`,
        value: candidate,
      })),
    });

    return project;
  }

  /** Boot a project this machine already has, then hand over as if it had just been created. */
  private async reopen(project: Reopenable): Promise<void> {
    const where = project.dir === '.' ? 'this folder' : `./${project.dir}`;
    this.logger.log(this.chalk.grey(`\n  (reopening "${project.name}" — ${where})`));

    if (project.kind === 'rails-app') return this.reopenRailsApp(project);
    if (project.kind === 'node-app') return this.reopenNodeApp(project);

    return this.reopenScaffold(project);
  }

  private async reopenRailsApp({ name, dir }: Reopenable): Promise<void> {
    const restart = `bin/rails server -p ${RAILS_PORT}`;
    const tail: Tail = {
      name,
      dir,
      restart,
      stack: "Forest mounted inside the user's Ruby on Rails app",
      url: `http://localhost:${RAILS_PORT}`,
    };
    if (this.dryRun) return this.reopenedDryRun(tail);

    const booted = this.boot('bin/rails', ['server', '-p', String(RAILS_PORT)], {
      cwd: dir,
      ready: /Listening on http|schema was updated/i,
      trouble: SCHEMA_SYNC_FAILED,
    });
    this.logger.log(this.chalk.grey(`\n$ ${restart}   (booting…)`));
    await booted.ready;
    if (booted.troubled()) this.doneInAppWithoutSchema(name, RAILS_PORT);
    else this.doneInApp(name, RAILS_PORT);

    return this.handoff({ ...tail, child: booted.child, mute: booted.mute });
  }

  private async reopenNodeApp({ name, dir, mounted }: Reopenable): Promise<void> {
    const tail: Tail = {
      name,
      dir,
      // The port `forest start` registered the project on, whatever the app defaults to.
      restart: `PORT=${NODE_PORT} npm start`,
      stack: "Forest mounted inside the user's Node.js app",
      url: `http://localhost:${NODE_PORT}`,
    };
    // An onboarding that stopped before the mount: booting now would wait on a Forest that is not
    // in the app. It picks up where it stopped instead — the snippet, then the boot once mounted.
    if (!mounted) await this.resumeMount(dir);
    if (this.dryRun) return this.reopenedDryRun(tail);

    const booted = this.boot('npm', ['start'], { cwd: dir, env: { PORT: String(NODE_PORT) } });
    this.logger.log(this.chalk.grey(`\n$ ${tail.restart}   (booting…)`));
    await booted.ready;
    this.doneInApp(name, NODE_PORT);

    return this.handoff({ ...tail, child: booted.child, mute: booted.mute });
  }

  private async resumeMount(dir: string): Promise<void> {
    this.logger.warn("Forest isn't mounted in this app's code yet — picking up the setup there.");

    const stack = detectNodeStack(dir);
    const driver = NODE_DATASOURCE[stack.orm] === SQL_DATASOURCE ? sqlDriver(dir) : undefined;
    this.explainMount('manual', stack, driver);

    if (this.dryRun) return;
    await this.ask({
      type: 'input',
      name: 'go',
      message: 'Once Forest is mounted in your server, press Enter to boot it',
    });
  }

  /**
   * A scaffold's code may have changed since — the coding agent works on it — so it is built
   * again, and installed first if it never was.
   */
  private async reopenScaffold({ name, dir, demo }: Reopenable): Promise<void> {
    if (this.dryRun || !fs.existsSync(path.join(dir, 'node_modules'))) {
      await this.run$('npm', ['install'], dir);
    }
    if (this.dryRun || StartCommand.hasBuildScript(dir)) {
      await this.run$('npm', ['run', 'build'], dir);
    }

    const port = StartCommand.readPort(dir) ?? DEMO_PORT;
    const tail: Tail = {
      name,
      dir,
      restart: 'npm start',
      stack: demo
        ? 'Forest demo back-end on sample data'
        : "standalone Forest agent on the user's own database",
      url: `http://localhost:${port}`,
      demo,
    };
    if (this.dryRun) return this.reopenedDryRun(tail);

    const booted = this.boot('npm', ['start'], { cwd: dir });
    this.logger.log(this.chalk.grey('\n$ npm start   (booting — waiting for the schema push…)'));
    await booted.ready;
    this.doneStandalone(name, port);

    return this.handoff({ ...tail, child: booted.child, mute: booted.mute });
  }

  private async reopenedDryRun(tail: Tail): Promise<void> {
    this.logger.log(this.chalk.grey(`\n$ ${StartCommand.restartCommand(tail.dir, tail.restart)}`));

    return this.handoff(tail);
  }

  private async pickStack(fromFlag?: 'rails' | 'node'): Promise<'rails' | 'node'> {
    if (fromFlag) return fromFlag;

    // Detection picks the DEFAULT, never the answer: a Rails repo can still host the Node app the
    // user means, and a guess that cannot be overridden is worse than no guess.
    const detected = detectRails() ? 'rails' : 'node';
    if (!this.interactive) return detected;

    const { stack } = await this.ask({
      type: 'list',
      name: 'stack',
      message: 'Your stack?',
      default: detected,
      choices: [
        { name: 'Ruby on Rails', value: 'rails' },
        { name: 'Node.js (Express / NestJS / Fastify / Koa)', value: 'node' },
      ],
    });

    return stack;
  }

  /** One prompt for every flow. `createsDir` is the only difference that ever mattered: standalone
   *  scaffolds ./<name>, so a collision is fatal; in-app writes nothing to disk. */
  private async promptName(
    fromFlag?: string,
    { def = 'my-back-office', createsDir = false } = {},
  ): Promise<string> {
    const collides = (name: string) => createsDir && !this.dryRun && fs.existsSync(name);

    if (fromFlag || !this.interactive) {
      const name = fromFlag ?? def;
      // Nobody to ask, and past this point a project exists server-side while the scaffold skips
      // every existing file: the old app would boot as if it were the new one.
      if (collides(name)) throw new Error(`./${name} already exists — pass another --name.`);

      return name;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- a retry loop is sequential by nature
      const { name } = await this.ask({
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: def,
      });
      if (!collides(name)) return name;
      this.logger.warn(`./${name} already exists — pick another name.`);
    }
  }

  // ---------- flows ----------

  private async flowDemo(): Promise<void> {
    // Drawn until free: `create:demo` would register a project, then skip every existing file.
    let name: string;
    do {
      name = `forest-demo-${Math.random().toString(36).slice(2, 6)}`;
    } while (!this.dryRun && fs.existsSync(name));

    await this.forest([
      'projects:create:demo',
      name,
      '-l',
      'typescript',
      '-H',
      'http://localhost',
      '-P',
      String(DEMO_PORT),
    ]);
    await this.installAndBuild(name);

    // The demo ships a curated layout; applying it needs the schema pushed first, so boot once.
    const layout = [
      'layout:apply',
      'forest-layout.json',
      '--with-workflows',
      '-e',
      'Development',
      '-t',
      'Operations',
      '-f',
    ];

    let child: ChildProcess | undefined;
    let exited: Promise<unknown> | undefined;

    if (this.dryRun) {
      this.logger.log(this.chalk.grey('\n$ npm start   (background — wait for schema push)'));
    } else {
      const booted = this.boot('npm', ['start'], { cwd: name });
      ({ child, exited } = booted);
      this.logger.log(this.chalk.grey('\n$ npm start   (booting — waiting for the schema push…)'));
      await booted.ready;
      this.logger.success('Schema pushed — applying curated layout + workflows');
    }

    await this.forest(layout, name);
    this.doneDemo(name);

    // One tail for both modes: --dry-run exists to review the flow, and skipping its ending would
    // hide the part most worth reviewing.
    if (this.interactive) {
      await this.demoMenu(child, name, exited);

      return;
    }

    stopProcess(child);
    this.logger.log(this.chalk.grey(`  Launch it anytime: cd ${name} && npm start`));
    this.logger.log(this.chalk.grey('  Connect real data: forest projects:create:sql'));
  }

  private async flowStandalone(flags: Record<string, string | undefined>): Promise<void> {
    const name = await this.promptName(flags.name, { createsDir: true });
    // `create:sql` prompts for the database itself — including the connection URL — so nothing
    // about the user's credentials ever passes through this wrapper.
    // TypeScript, as every other flow generates, and localhost, which a back-end on this machine
    // always is: neither question has another answer here. JavaScript stays one flag away, on
    // `create:sql` itself.
    const args = ['projects:create:sql', name, '-l', 'typescript', '-H', 'http://localhost'];

    // Without a --db, `create:sql` asks for the database itself, and for a port: forcing one would
    // take away the choice of a free one.
    if (flags.db) {
      args.push(
        '--databaseConnectionURL',
        flags.db,
        '-s',
        flags.schema ?? 'public',
        '-P',
        String(DEMO_PORT),
      );
    }

    await this.forest(args);
    await this.installAndBuild(name);
    this.logger.success(`Setup complete — booting your back-end on :${DEMO_PORT}…`);

    const tail: Tail = {
      name,
      dir: name, // `create:sql` scaffolded ./<name>
      restart: 'npm start',
      stack: "standalone Forest agent on the user's own database",
      url: `http://localhost:${DEMO_PORT}`,
    };

    if (this.dryRun) {
      this.logger.log(this.chalk.grey(`\n$ npm start   (back-end stays live on :${DEMO_PORT})`));
      this.doneStandalone(name, DEMO_PORT);
      await this.handoff(tail);

      return;
    }

    // Without --db the port came from `create:sql`'s own prompt, so DEMO_PORT is a guess. The
    // generated .env records what was actually chosen — reporting the wrong one would send both
    // the user and the coding agent to a back-end that is not listening there.
    const port = StartCommand.readPort(name) ?? DEMO_PORT;
    tail.url = `http://localhost:${port}`;

    const booted = this.boot('npm', ['start'], { cwd: name });
    this.logger.log(this.chalk.grey('  (waiting for the schema push…)'));
    await booted.ready;
    this.doneStandalone(name, port);
    await this.handoff({ ...tail, child: booted.child, mute: booted.mute });
  }

  private async flowInAppRails(flags: Record<string, string | undefined>): Promise<void> {
    const name = await this.promptName(flags.name);
    const output = await this.forestCapture([
      'projects:create:in-app',
      name,
      '-H',
      'http://localhost',
      '-P',
      String(RAILS_PORT),
      '--format',
      'json',
    ]);
    const secrets = StartCommand.parseSecrets(output);

    // Checked before `bundle add`: past that point five gems and a lockfile change are in the
    // user's repo, and throwing "nothing was generated" would be false.
    if (!secrets.envSecret && !this.dryRun) {
      throw new Error(
        'Could not read FOREST_ENV_SECRET from `projects:create:in-app`. Nothing was installed — ' +
          'run it by hand and pass the secret to `bin/rails g forest_admin_rails:install`.',
      );
    }

    // Five gems, not the three the docs list: forest_admin_rails alone installs but fails to boot,
    // because it does not declare its companions as runtime dependencies.
    await this.run$('bundle', [
      'add',
      'forest_admin_agent',
      'forest_admin_rails',
      'forest_admin_datasource_active_record',
      'forest_admin_datasource_toolkit',
      'forest_admin_datasource_customizer',
    ]);
    await this.run$('bin/rails', [
      'g',
      'forest_admin_rails:install',
      secrets.envSecret ?? '<FOREST_ENV_SECRET>',
    ]);

    const tail: Tail = {
      name,
      dir: '.', // in-app scaffolds nothing: the repo is the user's own
      restart: `bin/rails server -p ${RAILS_PORT}`,
      stack: "Forest mounted inside the user's Ruby on Rails app",
      url: `http://localhost:${RAILS_PORT}`,
    };

    if (this.dryRun) {
      this.logger.log(this.chalk.grey(`\n$ bin/rails server -p ${RAILS_PORT}`));
      this.doneInApp(name, RAILS_PORT);
      await this.handoff(tail);

      return;
    }

    const booted = this.boot('bin/rails', ['server', '-p', String(RAILS_PORT)], {
      // Puma's bind line stays accepted here: when `forest_admin_rails` logs its schema push is
      // unverified, and waiting for a line that never comes would fail every Rails boot.
      ready: /Listening on http|schema was updated/i,
      // So the success line is read instead from the failure the agent does print.
      trouble: SCHEMA_SYNC_FAILED,
    });
    this.logger.log(this.chalk.grey(`\n$ bin/rails server -p ${RAILS_PORT}   (booting…)`));
    await booted.ready;
    if (booted.troubled()) this.doneInAppWithoutSchema(name, RAILS_PORT);
    else this.doneInApp(name, RAILS_PORT);
    await this.handoff({ ...tail, child: booted.child, mute: booted.mute });
  }

  private async flowInAppNode(flags: Record<string, string | undefined>): Promise<void> {
    // Asked FIRST, and on purpose: "mount on standalone" abandons this flow, and everything below
    // has side effects — a Forest project created server-side, and packages written into the
    // user's own package.json. Asking after would leave both behind.
    const mount = await this.pickMount(flags.mount as string | undefined);
    if (mount === 'standalone') {
      this.logger.log(
        this.chalk.grey(
          '\n→ Mount on standalone: Forest runs as its own back-end on your DB (no code change).',
        ),
      );

      await this.flowStandalone(flags);

      return;
    }

    const name = await this.promptName(flags.name);
    const output = await this.forestCapture([
      'projects:create:in-app',
      name,
      '-H',
      'http://localhost',
      '-P',
      String(NODE_PORT),
      '--format',
      'json',
    ]);
    const secrets = StartCommand.parseSecrets(output);

    if (!secrets.envSecret && !this.dryRun) {
      throw new Error(
        'Could not read FOREST_ENV_SECRET from `projects:create:in-app`. Nothing was installed — ' +
          'run it by hand and set FOREST_ENV_SECRET / FOREST_AUTH_SECRET on your app.',
      );
    }

    const stack = detectNodeStack();
    // The SQL datasource reaches the database through a driver it does not ship: without one the
    // agent crashes at boot. An app on Sequelize or Mongoose brings its own with its ORM.
    const driver: SqlDriver | undefined =
      NODE_DATASOURCE[stack.orm] === SQL_DATASOURCE ? sqlDriver() : undefined;
    await this.run$('npm', [
      'install',
      '@forestadmin/agent',
      NODE_DATASOURCE[stack.orm],
      ...(driver?.status === 'from-url' ? [driver.package] : []),
    ]);

    this.explainMount(mount, stack, driver);

    const tail: Tail = {
      name,
      dir: '.', // in-app scaffolds nothing: the repo is the user's own
      // The project was registered on this port, and the user's app may default to another one.
      restart: `PORT=${NODE_PORT} npm start`,
      stack: "Forest mounted inside the user's Node.js app",
      url: `http://localhost:${NODE_PORT}`,
    };

    if (this.dryRun) {
      this.logger.log(
        this.chalk.grey('\n$ npm start   (with FOREST_ENV_SECRET / FOREST_AUTH_SECRET)'),
      );
      this.doneInApp(name, NODE_PORT);
      await this.handoff(tail);

      return;
    }

    if (!this.interactive) {
      // Written, never printed: this path is where CI logs are produced, and `FOREST_ENV_SECRET`
      // is a long-lived credential — anyone who can read the retained log gets the project. A
      // warning next to the value would not have stopped that.
      this.reportSecrets(writeSecrets(secrets));
      this.logger.log(this.chalk.grey(`  Then run:  ${tail.restart}`));

      return;
    }

    // Persisted before booting, not just passed to this one process: everything the user is told
    // afterwards — the restart hint, `npm start` — runs without our environment.
    const written = writeSecrets(secrets);
    this.reportSecrets(written);

    // The agent mounts Forest with the skills, so both come before the boot waits on a mount.
    if (mount === 'ai') {
      const inDotenv = !written.conflicts.length && !written.shadowed.length;
      await this.mountWithAgent(stack, inDotenv, driver).catch(error => {
        // The project exists by now: a failed agent step costs the snippet, never the setup.
        this.logger.warn(`${(error as Error).message}\n  Mount it by hand instead:`);
        this.explainMount('manual', stack, driver);
      });
    }

    await this.ask({
      type: 'input',
      name: 'go',
      message: 'Once Forest is mounted in your server, press Enter to boot it',
    });
    const booted = this.boot('npm', ['start'], {
      env: { ...bootSecrets(secrets, written), PORT: String(NODE_PORT) },
    });
    this.logger.log(this.chalk.grey('\n$ npm start   (booting…)'));
    await booted.ready;
    this.doneInApp(name, NODE_PORT);
    await this.handoff({ ...tail, child: booted.child, mute: booted.mute });
  }

  private async pickMount(fromFlag?: string): Promise<string> {
    if (fromFlag === 'ai' && !this.canInstallSkills) {
      // Nothing would mount Forest, and the boot would then wait for a Forest it cannot see.
      this.logger.warn(
        'This CLI cannot install the Forest skills, so here is the snippet instead.',
      );

      return 'manual';
    }

    if (fromFlag) return fromFlag;
    // Nothing here can install the skills or launch an agent, so only the snippet can be followed.
    if (!this.interactive) return 'manual';

    const { mount } = await this.ask({
      type: 'list',
      name: 'mount',
      message: 'How do you want to mount Forest?',
      choices: [
        ...(this.canInstallSkills
          ? [{ name: 'Wire it in with your coding agent', value: 'ai' }]
          : []),
        { name: 'Mount it manually (snippet)', value: 'manual' },
        { name: 'Mount on standalone', value: 'standalone' },
      ],
    });

    return mount;
  }

  /** Install the skills the agent mounts with, then offer to launch it on that one task. */
  private async mountWithAgent(
    stack: NodeStack,
    secretsInDotenv: boolean,
    driver?: SqlDriver,
  ): Promise<void> {
    if (!this.canInstallSkills) return;

    await this.forest(['skills:init']);

    const [agent] = StartCommand.launchableAgents('.');
    if (!agent || !(await this.confirm(`Launch ${agent.label} now to wire the mount?`))) return;

    await StartCommand.leavingCtrlCTo(() =>
      this.run$(agent.bin, [StartCommand.mountSeed(stack, secretsInDotenv, driver)]),
    );
  }

  private static mountSeed(stack: NodeStack, secretsInDotenv: boolean, driver?: SqlDriver): string {
    // On a conflict the new project's secrets are in neither `.env` nor the shell: an agent told
    // otherwise would wire the app to whichever project those hold.
    const secrets = secretsInDotenv
      ? 'FOREST_ENV_SECRET / FOREST_AUTH_SECRET are in .env'
      : "this project's FOREST_ENV_SECRET / FOREST_AUTH_SECRET are not configured yet, so ask me for them rather than reusing the ones already there";
    const installed = ['@forestadmin/agent', NODE_DATASOURCE[stack.orm]];
    if (driver && driver.status !== 'unknown') installed.push(driver.name);
    const missingDriver =
      driver?.status === 'unknown'
        ? ` Its database driver is not installed: install the one matching DATABASE_URL (${SQL_DRIVER_NAMES}).`
        : '';

    return (
      `You're in a ${stack.framework} app using ${stack.orm}. ${installed.join(', ')} are ` +
      `installed, and ${secrets}.${missingDriver} Mount the Forest agent in my server, then ` +
      "stop: don't start the server, `forest start` boots it once you are done."
    );
  }

  private explainMount(mount: string, stack: NodeStack, driver?: SqlDriver): void {
    if (mount === 'ai') {
      this.instruct('Your coding agent will wire the mount:', [
        `in your repo, ask it: ${this.chalk.cyan('"mount the Forest agent in my server"')}`,
        this.chalk.grey('→ it reads your server, inserts the mount, shows you the diff.'),
      ]);

      return;
    }

    // Must match the package just installed, IMPORT INCLUDED: a snippet calling
    // `createMongooseDataSource` while importing only `createAgent` does not compile, and the
    // reader has no way to know which package the missing symbol comes from.
    const sqlDataSource = {
      factory: 'createSqlDataSource',
      call: 'createSqlDataSource(process.env.DATABASE_URL)',
    };
    const { factory, call } = {
      sql: sqlDataSource,
      sequelize: {
        factory: 'createSequelizeDataSource',
        call: 'createSequelizeDataSource(sequelize)',
      },
      mongoose: {
        factory: 'createMongooseDataSource',
        call: 'createMongooseDataSource(connection)',
      },
      typeorm: sqlDataSource,
      prisma: sqlDataSource,
    }[stack.orm];

    // `import` breaks a CommonJS app ("Cannot use import statement outside a module"), which is
    // what most existing Express apps are: it is only printed where it compiles.
    const load = (names: string, from: string) =>
      stack.typescript || stack.esm
        ? `import { ${names} } from '${from}';`
        : `const { ${names} } = require('${from}');`;

    this.instruct('Add to your server (after your ORM is ready, before app.listen):', [
      this.chalk.cyan(load('createAgent', '@forestadmin/agent')),
      this.chalk.cyan(load(factory, NODE_DATASOURCE[stack.orm])),
      this.chalk.cyan(
        'createAgent({ authSecret: process.env.FOREST_AUTH_SECRET, envSecret: process.env.FOREST_ENV_SECRET, isProduction: false })',
      ),
      this.chalk.cyan(
        `  .addDataSource(${call}).mountOn${mountHelper(stack.framework)}(app).start();`,
      ),
      this.chalk.grey(`Mount options → ${DOCS_URL}/reference/agent-api/nodejs`),
      // Without a driver the agent crashes at boot, and nothing here could tell which one.
      ...(driver?.status === 'unknown'
        ? [
            this.chalk.yellow(
              `No DATABASE_URL found, so no database driver was installed: add yours too (${SQL_DRIVER_NAMES}).`,
            ),
          ]
        : []),
    ]);
  }

  /** A JavaScript scaffold has no build step at all, and `npm run build` would fail on the missing
   *  script. */
  private async installAndBuild(dir: string): Promise<void> {
    await this.run$('npm', ['install'], dir);
    // A dry run scaffolded nothing to read, so it shows the TypeScript path the demo always takes.
    if (!this.dryRun && !StartCommand.hasBuildScript(dir)) return;

    await this.run$('npm', ['run', 'build'], dir);
  }

  private static hasBuildScript(dir: string): boolean {
    try {
      const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));

      return Boolean(pkg.scripts?.build);
    } catch {
      return false;
    }
  }

  // ---------- tails ----------

  /** The demo is a TRAMPOLINE: its menu exists to nudge you towards connecting real data. */
  private async demoMenu(
    child: ChildProcess | undefined,
    name: string,
    exited?: Promise<unknown>,
  ): Promise<void> {
    const { next } = await this.ask({
      type: 'list',
      name: 'next',
      message: 'What next?',
      choices: [
        { name: 'Connect my real database (create a real project)', value: 'db' },
        { name: KEEP_RUNNING, value: 'stay' },
        { name: 'Stop', value: 'stop' },
      ],
    });
    // No "invite a developer": the first production deploy is what creates the project's first
    // role, so inviting before it silently invites into nothing.

    if (next === 'db') {
      stopProcess(child);
      // Signalled is not gone: the real back-end boots on the same port.
      await exited;
      this.logger.log(
        this.chalk.grey('\n  (demo back-end stopped — setting up your real project)\n'),
      );

      await this.flowStandalone({});

      return;
    }

    if (next === 'stay') {
      if (child) await this.keepAlive(child, name, 'npm start');

      return;
    }

    stopProcess(child);
    this.logger.log(
      this.chalk.grey(`\n  Stopped. Relaunch the demo anytime: cd ${name} && npm start`),
    );
  }

  /**
   * The end of every real flow. A loop, like the demo's, because these are steps you chain — teach
   * the agent, then deploy — not a one-shot question.
   */
  private async handoff(tail: Tail): Promise<void> {
    if (!this.interactive) {
      if (tail.child) {
        stopProcess(tail.child);
        this.logger.log(
          this.chalk.grey(
            `  Launch it anytime: ${StartCommand.restartCommand(tail.dir, tail.restart)}`,
          ),
        );
      }

      return;
    }

    let done = false;
    while (!done) {
      // eslint-disable-next-line no-await-in-loop -- a menu loop is sequential by nature
      const { next } = await this.ask({
        type: 'list',
        name: 'next',
        message: 'Your back-office is live. What next?',
        choices: [
          ...this.agentChoice(tail),
          { name: 'Deploy to production (guide)', value: 'deploy' },
          { name: `Get started guide (${DOCS_URL})`, value: 'docs' },
          { name: KEEP_RUNNING, value: 'stay' },
        ],
      });

      // A failed step here is recoverable: the back-end is live, so the menu comes back rather
      // than `run` tearing everything down.
      // eslint-disable-next-line no-await-in-loop -- sequential by nature
      await this.handoffChoice(next, tail).catch(error => {
        this.logger.warn(`${(error as Error).message}\n  Your back-end is still running.`);
      });
      done = next === 'stay';
    }

    if (tail.child) await this.keepAlive(tail.child, tail.dir, tail.restart);
  }

  /**
   * The coding-agent entry, saying what it does before it is picked: open the agent the skills were
   * set up for, or set them up first. None when this CLI cannot install the skills.
   */
  private agentChoice(tail: Tail): { name: string; value: string }[] {
    const [agent] = StartCommand.launchableAgents(tail.dir);
    if (agent)
      return [{ name: `Open ${agent.label} here, with the Forest skills`, value: 'agent' }];
    if (!this.canInstallSkills) return [];

    return [
      {
        name: 'Set up your coding agent with the Forest skills, then open it here',
        value: 'agent',
      },
    ];
  }

  /** One menu choice. Every one of them comes back to the menu. */
  private async handoffChoice(choice: string, tail: Tail): Promise<void> {
    if (choice === 'docs') {
      this.instruct('Get started guide:', [this.chalk.cyan(DOCS_URL)]);

      return;
    }

    if (choice === 'agent') {
      if (!StartCommand.launchableAgents(tail.dir).length) {
        // No --agent: `skills:init` asks which agents this repo uses, with the full list and its
        // own repo-aware detection. One question, asked once, where the answer belongs.
        await this.forest(['skills:init'], tail.dir);
        if (!(await this.offerLaunch(tail))) return;
      }

      await this.launch(tail, StartCommand.seed(tail));

      return;
    }

    if (choice === 'deploy') {
      // The docs, not a skill: no skill covers deploying any more, and nothing here sets up the
      // production side (its environment, its secrets) either. A pointer that exists beats a
      // coding agent sent after steps it does not have.
      this.instruct('Deploy to production:', [
        `Follow ${this.chalk.cyan(`${DOCS_URL}/get-started/deploy`)}`,
        this.chalk.grey(
          'Host this back-end anywhere that runs Node.js, then add a production environment in Forest that points at it.',
        ),
      ]);
    }
  }

  /** Whether to open the agent the skills were just set up for: there may be none to open. */
  private async offerLaunch(tail: Tail): Promise<boolean> {
    const [agent] = StartCommand.launchableAgents(tail.dir);
    if (!agent) return false;

    return this.confirm(`Open ${agent.label} here now?`);
  }

  /**
   * Hand the terminal to a coding agent, then take it back: the back-end keeps running throughout,
   * and quitting the agent returns to the menu — the next step (deploy, another session) is there.
   */
  private async launch(tail: Tail, seed: string): Promise<void> {
    const [agent] = StartCommand.launchableAgents(tail.dir);
    if (!agent) return;

    this.logger.log(
      this.chalk.grey(
        `\n  (opening ${agent.label} — your Forest back-end keeps running underneath, and quitting it brings you back here)`,
      ),
    );
    // The agent takes over a full-screen terminal; back-end log lines drawn into it corrupt the
    // display for the whole session. It keeps running, we just stop echoing it.
    const unmute = tail.mute?.();
    try {
      await StartCommand.leavingCtrlCTo(() => this.run$(agent.bin, [seed], tail.dir));
    } finally {
      unmute?.();
    }

    this.logger.log(
      this.chalk.grey(`\n  (back from ${agent.label} — your back-end is still running)`),
    );
  }

  /**
   * Run a foreground program that handles Ctrl-C itself — a coding agent, for which it is an
   * ordinary key. The terminal sends the signal to this process too, whose handlers exit and take
   * the back-end down mid-session. They are set aside for the duration, and put back after.
   */
  private static async leavingCtrlCTo<T>(run: () => Promise<T>): Promise<T> {
    const listeners = process.rawListeners('SIGINT') as ((...args: unknown[]) => void)[];
    const ignore = () => undefined;
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', ignore);

    try {
      return await run();
    } finally {
      process.removeListener('SIGINT', ignore);
      listeners.forEach(listener => process.on('SIGINT', listener));
    }
  }

  /** Hold the back-end in the foreground so a closed window is never a dead end. */
  private keepAlive(child: ChildProcess, dir: string, restart: string): Promise<void> {
    // Its `exit` already fired, so listening for it would hold the terminal until a Ctrl-C.
    if (child.exitCode !== null || child.signalCode !== null) {
      this.logger.warn(
        `Your back-end has stopped. Restart it: ${StartCommand.restartCommand(dir, restart)}`,
      );

      return Promise.resolve();
    }

    this.logger.log(
      this.chalk.grey(
        '\n  ▸ This terminal now runs your back-end (live logs below). Keep it open.',
      ),
    );
    this.logger.log(
      this.chalk.grey(
        `     Ctrl-C to stop  ·  restart later: ${StartCommand.restartCommand(dir, restart)}`,
      ),
    );

    return new Promise((resolve, reject) => {
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        this.logger.log(
          `\n\n${this.chalk.yellow('■')} Back-end stopped. Restart it anytime → ${this.chalk.cyan(
            StartCommand.restartCommand(dir, restart),
          )}`,
        );
        stopProcess(child, 'SIGINT');
        resolve();
      };
      // Ahead of the process runner's own hook, which exits on SIGINT before a later listener runs.
      process.prependOnceListener('SIGINT', stop);
      child.on('exit', (code, signal) => {
        if (stopped) return resolve();

        // Nobody asked it to stop: ending here in silence, and with success, would leave the user
        // at a prompt with a dead back-office and nothing saying so.
        stopped = true;
        process.removeListener('SIGINT', stop);
        const status = signal ?? `exit code ${code}`;
        const restartIt = StartCommand.restartCommand(dir, restart);
        this.logger.warn(
          `Your back-end stopped on its own (${status}). Its logs are above.\n  Restart it: ${restartIt}`,
        );
        try {
          this.exit(1);
        } catch (exit) {
          reject(exit);
        }

        return undefined;
      });
    });
  }

  /** How to start a back-end again. In-app flows run in the user's own folder: no `cd .` there. */
  private static restartCommand(dir: string, restart: string): string {
    return dir === '.' ? restart : `cd ${dir} && ${restart}`;
  }

  // ---------- seeds & helpers ----------

  /**
   * What the CLI knows and the coding agent would otherwise have to guess — or guess wrong. Two
   * facts earn their place: the back-end is ALREADY running (a fresh agent's first reflex is to
   * boot it, which collides on the port or kills the live one), and nothing is deployed yet, so no
   * role exists and inviting anyone is premature. Everything durable belongs in the skills.
   */
  private static seed(tail: Tail): string {
    const situation = [
      `Stack: ${tail.stack}.`,
      `Its back-end is already running on ${tail.url} — it is live, don't start it.`,
      tail.demo
        ? "The records are Forest sample data, not the user's own database."
        : 'Development only: no production environment exists yet, so no role exists either.',
      'The Forest skills and the Forest docs MCP are installed in this repo.',
    ].join(' ');

    // The situation, not a task: worded as the user's request, examples become a to-do list the
    // agent starts on unasked.
    const ask =
      'Briefly tell me what you can help with in this Forest project, then wait for my request.';

    return `You're in a Forest project. ${situation} ${ask}`;
  }

  /**
   * Which coding agents `skills:init` actually set up, read back from the manifest it just wrote.
   * We deliberately do not detect them here: the toolbelt already does it, better — from the repo's
   * own marks, and knowing Cursor and OpenCode too — and asking twice makes a flow feel like a form.
   */
  private static launchableAgents(cwd: string): { bin: string; label: string }[] {
    const labels: Record<string, string> = { claude: 'Claude Code', codex: 'Codex' };
    try {
      const manifest = JSON.parse(
        fs.readFileSync(`${cwd}/.forest/skills-manifest.json`, 'utf8'),
      ) as { agents?: string[] };

      return (manifest.agents ?? [])
        .filter(agent => labels[agent])
        .map(agent => ({ bin: agent, label: labels[agent] }));
    } catch {
      return []; // no manifest → skills were never installed here
    }
  }

  /** Say what actually happened to the secrets — never the values themselves. */
  private reportSecrets({ file, written, conflicts, shadowed, exposed }: SecretsWrite): void {
    if (written.length)
      this.logger.success(`${written.join(' and ')} written to ${file} — do not commit it.`);
    if (exposed) {
      this.logger.warn(
        `${file} could not be made private to you: run \`chmod 600 ${file}\` to keep it that way.`,
      );
    }
    if (conflicts.length) {
      this.logger.warn(
        `${conflicts.join(
          ' and ',
        )} already set to a different value in ${file} — left untouched. ` +
          'Your app will keep using the existing project until you replace it.',
      );
    }
    if (shadowed.length) {
      this.logger.warn(
        `${shadowed.join(' and ')} already exported in your shell, which wins over ${file}. ` +
          'Unset it for your app to use this project.',
      );
    }
    if (!written.length && !conflicts.length) {
      this.logger.warn(`No secret was returned, so nothing was written to ${file}.`);
    }
  }

  /**
   * Read the secrets `projects:create:in-app` printed.
   *
   * Two shapes on purpose: the `--format json` document when the CLI supports it, and otherwise
   * the human output, which prints `FOREST_ENV_SECRET=…` ungated for exactly this consumer. The
   * fallback is what makes this work against a CLI that predates the flag rather than dying on
   * `Nonexistent flag: --format`.
   */
  private static parseSecrets(output: string): { envSecret?: string; authSecret?: string } {
    try {
      const parsed = JSON.parse(output.trim());
      if (parsed?.envSecret) return parsed;
    } catch {
      // Not JSON — fall through to the human output.
    }

    return {
      envSecret: /FOREST_ENV_SECRET=(\S+)/.exec(output)?.[1],
      authSecret: /FOREST_AUTH_SECRET=(\S+)/.exec(output)?.[1],
    };
  }

  private doneDemo(name: string): void {
    this.logger.success(
      `Demo back-office live → ${this.chalk.cyan(`https://app.forestadmin.com/${name}`)}`,
    );
    this.servedByThisTerminal(DEMO_PORT);
  }

  /**
   * The link and the port, tied together. The UI is hosted, but the browser loads the records from
   * the back-end in this terminal: closing it is what breaks the link, and nothing else says so.
   */
  private servedByThisTerminal(port: number): void {
    this.logger.log(
      `  Your browser reads its data from the back-end in this terminal (localhost:${port}): keep it open.`,
    );
  }

  /** The port the scaffolded project actually runs on, from its generated .env. */
  private static readPort(dir: string): number | undefined {
    try {
      const port = /^APPLICATION_PORT=(\d+)/m.exec(fs.readFileSync(`${dir}/.env`, 'utf8'))?.[1];

      return port ? Number(port) : undefined;
    } catch {
      return undefined;
    }
  }

  private doneStandalone(name: string, port: number): void {
    this.logger.success('Your back-office is live!');
    this.logger.log(
      `  ${this.chalk.bold('Open it →')} ${this.chalk.cyan(`https://app.forestadmin.com/${name}`)}`,
    );
    this.servedByThisTerminal(port);
  }

  /**
   * The app is up and `/forest` answers, but Forest has no schema for it: the panel opens empty.
   * Said here rather than in `doneInApp`, because "live" would be the one thing the user should
   * not conclude. The two causes seen in practice are named — an app with no model for the
   * datasource to read, and Rails < 8.1, whose ActiveSupport passes an option `json` 3 rejects.
   */
  private doneInAppWithoutSchema(name: string, port: number): void {
    this.logger.warn('Forest is mounted, but your schema never reached it.');
    this.logger.log('  The back-office will open empty until the next boot pushes it.');
    this.logger.log(`  ${this.chalk.bold('Check →')} your app exposes at least one model`);
    this.logger.log(
      `  ${this.chalk.bold('Check →')} Rails 8.1+ or 7.2.4+ (older ones break on \`json\` 3)`,
    );
    this.logger.log(
      `  ${this.chalk.bold('Then →')} ${this.chalk.grey(`bin/rails server -p ${port}`)}`,
    );
    this.logger.log(`  ${this.chalk.bold('Local /forest →')} http://localhost:${port}/forest`);
    this.logger.log(
      `  ${this.chalk.bold('Dashboard →')} ${this.chalk.cyan(
        `https://app.forestadmin.com/${name}`,
      )}`,
    );
  }

  private doneInApp(name: string, port: number): void {
    this.logger.success('Forest is live in your app!');
    this.logger.log(`  ${this.chalk.bold('Local /forest →')} http://localhost:${port}/forest`);
    this.logger.log(
      `  ${this.chalk.bold('Dashboard →')} ${this.chalk.cyan(
        `https://app.forestadmin.com/${name}`,
      )}`,
    );
  }
}
