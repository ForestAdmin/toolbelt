import type { NodeStack } from '../services/onboarding/detect';
import type { ChildProcess } from 'child_process';

import { Flags } from '@oclif/core';
import fs from 'fs';

import AbstractCommand from '../abstract-command';
import {
  NODE_DATASOURCE,
  detectNodeStack,
  detectRails,
  mountHelper,
} from '../services/onboarding/detect';
import {
  runCapture,
  runStep,
  startProcess,
  stopAllProcesses,
  stopProcess,
} from '../services/process-runner';

const DOCS_URL = 'https://docs.forest.app';
const DEMO_PORT = 3310;
const RAILS_PORT = 3002;
const NODE_PORT = 3001;

// Broad "the back-end is up" marker: covers standalone ("mounted on Standalone server"), in-app
// Node ("mounted on Express.js") and Rails ("schema was updated" / Puma).
const READY = /Successfully mounted on|schema was (updated|not updated)|Listening on http/i;

type Flow = 'demo' | 'standalone' | 'inapp';
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
  mute?: () => void;
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

  // eslint-disable-next-line class-methods-use-this -- reads the ambient TTY, not instance state
  private get interactive(): boolean {
    return Boolean(process.stdin.isTTY);
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(StartCommand);
    this.dryRun = flags['dry-run'];

    try {
      await this.onboard(flags as Record<string, string | undefined>);
    } catch (error) {
      // Anything after a boot — `layout:apply`, `skills:init`, the agent launch — can fail. The
      // back-end is detached, so it would survive, and its open pipes can keep this command alive
      // with it: an error message followed by a prompt that never returns, and a port still held.
      stopAllProcesses();

      throw error;
    }
  }

  private async onboard(flags: Record<string, string | undefined>): Promise<void> {
    this.logger.log(
      `\nWelcome to ${this.chalk.green('Forest')}. Let's get your back-office running.`,
    );

    await this.forest(['login']); // OIDC device flow (browser signup/login)

    const flow = await this.pickFlow(flags.flow as Flow | undefined);

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
  private static redact(command: string, args: string[]): string {
    const shown = args.map((arg, index) => {
      const previous = args[index - 1];

      if (previous === '--databaseConnectionURL' || previous === '-c') return '<redacted>';
      if (command === 'bin/rails' && previous === 'forest_admin_rails:install') return '<redacted>';

      return arg;
    });

    return `${command} ${shown.join(' ')}`.trim();
  }

  /** Run a command, echoing it first. The echo is the point: it teaches what the wrapper does. */
  private async run$(command: string, args: string[], cwd?: string): Promise<void> {
    this.logger.log(this.chalk.grey(`\n$ ${StartCommand.redact(command, args)}`));
    if (this.dryRun) return this.logger.log(this.chalk.grey('  (dry-run — not executed)'));

    return runStep(command, args, { cwd });
  }

  /** Invoke one of our own commands. Resolved through this executable, never through the PATH:
   *  under `npx forest-cli@latest start` there may be no `forest` installed anywhere. */
  private forest(args: string[], cwd?: string): Promise<void> {
    this.logger.log(this.chalk.grey(`\n$ ${StartCommand.redact('forest', args)}`));
    if (this.dryRun) {
      this.logger.log(this.chalk.grey('  (dry-run — not executed)'));

      return Promise.resolve();
    }

    return runStep(process.execPath, [process.argv[1], ...args], { cwd });
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
      const { stdout, stderr } = await runCapture(process.execPath, [
        process.argv[1],
        ...withoutFormat,
      ]);

      return `${stdout}\n${stderr}`;
    }
  }

  /** Boot a back-end, streaming its logs, and wait until its schema reached Forest. */
  private boot(
    command: string,
    args: string[],
    options: { cwd?: string; env?: Record<string, string>; ready?: RegExp } = {},
  ) {
    return startProcess(command, args, {
      ready: options.ready ?? READY,
      cwd: options.cwd,
      env: options.env,
      onOutput: chunk => this.logger.log(this.chalk.grey(`  | ${chunk.replace(/\n$/, '')}`)),
    });
  }

  private ask(question: Record<string, unknown>) {
    return this.context.inquirer.prompt([question]);
  }

  private async confirm(message: string): Promise<boolean> {
    return (await this.ask({ type: 'confirm', name: 'value', message, default: true })).value;
  }

  private instruct(title: string, lines: string[]): void {
    this.logger.log(`\n${this.chalk.bold(title)}`);
    lines.forEach(line => this.logger.log(`  ${line}`));
  }

  // ---------- questions ----------

  private async pickFlow(fromFlag?: Flow): Promise<Flow> {
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
      ],
    });

    return flow;
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
    if (fromFlag) return fromFlag;
    if (!this.interactive) return def;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop -- a retry loop is sequential by nature
      const { name } = await this.ask({
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: def,
      });
      if (!createsDir || this.dryRun || !fs.existsSync(name)) return name;
      this.logger.warn(`./${name} already exists — pick another name.`);
    }
  }

  // ---------- flows ----------

  private async flowDemo(): Promise<void> {
    const name = `forest-demo-${Math.random().toString(36).slice(2, 6)}`;

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

    if (this.dryRun) {
      this.logger.log(this.chalk.grey('\n$ npm start   (background — wait for schema push)'));
    } else {
      const booted = this.boot('npm', ['start'], { cwd: name });
      child = booted.child;
      this.logger.log(this.chalk.grey('\n$ npm start   (booting — waiting for the schema push…)'));
      await booted.ready;
      this.logger.success('Schema pushed — applying curated layout + workflows');
    }

    await this.forest(layout, name);
    this.doneDemo(name);

    // One tail for both modes: --dry-run exists to review the flow, and skipping its ending would
    // hide the part most worth reviewing.
    if (this.interactive) {
      await this.demoMenu(child, name);

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
    const args = ['projects:create:sql', name];

    // Without a --db, `create:sql` asks for everything itself — language and hostname included.
    // Forcing them here would quietly take away the choice of JavaScript or of a free port.
    if (flags.db) {
      args.push(
        '--databaseConnectionURL',
        flags.db,
        '-s',
        flags.schema ?? 'public',
        '-l',
        'typescript',
        '-H',
        'http://localhost',
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
      stack: "standalone Forest agent (TypeScript) on the user's own database",
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
      ready: /Listening on http|schema was updated/i,
    });
    this.logger.log(this.chalk.grey(`\n$ bin/rails server -p ${RAILS_PORT}   (booting…)`));
    await booted.ready;
    this.doneInApp(name, RAILS_PORT);
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
    await this.run$('npm', ['install', '@forestadmin/agent', NODE_DATASOURCE[stack.orm]]);

    this.explainMount(mount, stack);

    const tail: Tail = {
      name,
      dir: '.', // in-app scaffolds nothing: the repo is the user's own
      restart: 'npm start',
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
      this.reportSecrets(StartCommand.writeSecrets(secrets));
      this.logger.log(this.chalk.grey(`  Then run:  PORT=${NODE_PORT} npm start`));

      return;
    }

    // Persisted before booting, not just passed to this one process: everything the user is told
    // afterwards — the restart hint, `npm start` — runs without our environment.
    this.reportSecrets(StartCommand.writeSecrets(secrets));

    await this.ask({
      type: 'input',
      name: 'go',
      message: 'Once Forest is mounted in your server, press Enter to boot it',
    });
    const booted = this.boot('npm', ['start'], {
      env: {
        FOREST_ENV_SECRET: secrets.envSecret ?? '',
        FOREST_AUTH_SECRET: secrets.authSecret ?? '',
        PORT: String(NODE_PORT),
      },
    });
    this.logger.log(this.chalk.grey('\n$ npm start   (booting…)'));
    await booted.ready;
    this.doneInApp(name, NODE_PORT);
    await this.handoff({ ...tail, child: booted.child, mute: booted.mute });
  }

  private async pickMount(fromFlag?: string): Promise<string> {
    if (fromFlag) return fromFlag;
    if (!this.interactive) return 'ai';

    const { mount } = await this.ask({
      type: 'list',
      name: 'mount',
      message: 'How do you want to mount Forest?',
      choices: [
        { name: 'Wire it in with your coding agent', value: 'ai' },
        { name: 'Mount it manually (snippet)', value: 'manual' },
        { name: 'Mount on standalone', value: 'standalone' },
      ],
    });

    return mount;
  }

  private explainMount(mount: string, stack: NodeStack): void {
    if (mount === 'ai') {
      this.instruct(
        'Your coding agent will wire the mount (the Forest skills get installed at the end):',
        [
          `in your repo, ask it: ${this.chalk.cyan('"mount the Forest agent in my server"')}`,
          this.chalk.grey('→ it reads your server, inserts the mount, shows you the diff.'),
        ],
      );

      return;
    }

    // Must match the package just installed, IMPORT INCLUDED: a snippet calling
    // `createMongooseDataSource` while importing only `createAgent` does not compile, and the
    // reader has no way to know which package the missing symbol comes from.
    const { factory, call } = {
      sql: {
        factory: 'createSqlDataSource',
        call: 'createSqlDataSource(process.env.DATABASE_URL)',
      },
      sequelize: {
        factory: 'createSequelizeDataSource',
        call: 'createSequelizeDataSource(sequelize)',
      },
      mongoose: {
        factory: 'createMongooseDataSource',
        call: 'createMongooseDataSource(connection)',
      },
      typeorm: { factory: 'createTypeOrmDataSource', call: 'createTypeOrmDataSource(dataSource)' },
      prisma: { factory: 'createPrismaDataSource', call: 'createPrismaDataSource(prisma)' },
    }[stack.orm];

    this.instruct('Add to your server (after your ORM is ready, before app.listen):', [
      this.chalk.cyan("import { createAgent } from '@forestadmin/agent';"),
      this.chalk.cyan(`import { ${factory} } from '${NODE_DATASOURCE[stack.orm]}';`),
      this.chalk.cyan(
        'createAgent({ authSecret: process.env.FOREST_AUTH_SECRET, envSecret: process.env.FOREST_ENV_SECRET, isProduction: false })',
      ),
      this.chalk.cyan(
        `  .addDataSource(${call}).mountOn${mountHelper(stack.framework)}(app).start();`,
      ),
      this.chalk.grey(`Exact per-stack snippet → ${DOCS_URL}/…/in-app/${stack.framework}`),
    ]);
  }

  /** The generated project pins typescript ^4.9, which cannot parse recent `.d.cts` typings. */
  private async installAndBuild(dir: string): Promise<void> {
    await this.run$('npm', ['install'], dir);
    await this.run$('npm', ['install', '--save-dev', 'typescript@^5.5'], dir);
    await this.run$('npm', ['run', 'build'], dir);
  }

  // ---------- tails ----------

  /** The demo is a TRAMPOLINE: its menu exists to nudge you towards connecting real data. */
  private async demoMenu(child: ChildProcess | undefined, name: string): Promise<void> {
    const { next } = await this.ask({
      type: 'list',
      name: 'next',
      message: `Your demo back-end is live on :${DEMO_PORT}. What next?`,
      choices: [
        { name: 'Connect my real database (create a real project)', value: 'db' },
        { name: 'Keep exploring — leave the back-end running', value: 'stay' },
        { name: 'Stop', value: 'stop' },
      ],
    });
    // No "invite a developer": the first production deploy is what creates the project's first
    // role, so inviting before it silently invites into nothing.

    if (next === 'db') {
      stopProcess(child); // free the port for the real back-end
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
        this.logger.log(this.chalk.grey(`  Launch it anytime: cd ${tail.dir} && ${tail.restart}`));
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
          { name: 'Teach your coding agent about Forest', value: 'skills' },
          { name: 'Deploy to production', value: 'deploy' },
          { name: `Get started guide (${DOCS_URL})`, value: 'docs' },
          { name: 'Keep exploring — leave the back-end running', value: 'stay' },
        ],
      });

      // eslint-disable-next-line no-await-in-loop -- sequential by nature
      const handedOver = await this.handoffChoice(next, tail);
      if (handedOver) return; // the coding agent owns the terminal now
      done = next === 'stay';
    }

    if (tail.child) await this.keepAlive(tail.child, tail.dir, tail.restart);
  }

  /** One menu choice. Returns true when the terminal was handed to a coding agent. */
  private async handoffChoice(choice: string, tail: Tail): Promise<boolean> {
    if (choice === 'docs') {
      this.instruct('Get started guide:', [this.chalk.cyan(DOCS_URL)]);

      return false;
    }

    if (choice === 'skills') {
      // No --agent: `skills:init` asks which agents this repo uses, with the full list and its own
      // repo-aware detection. One question, asked once, where the answer belongs.
      await this.forest(['skills:init'], tail.dir);

      return this.offerLaunch(tail, StartCommand.seed('customise', tail));
    }

    if (choice === 'deploy') {
      // Deploying lives in the `deploy-heroku` SKILL, so it needs the skills installed first —
      // `forest deploy` ships layout changes, it does not deploy the app.
      if (await this.launch(tail, StartCommand.seed('deploy', tail))) return true;

      // Skills present, but no agent we can start from here — Cursor and OpenCode have them and
      // are not launchable. Sending those users back to `skills:init` loops them on a step they
      // have already done, with no way to ever reach a deploy.
      if (StartCommand.hasSkills(tail.dir)) {
        this.instruct('Ask your coding agent to deploy:', [
          this.chalk.cyan('"deploy this Forest project to production"'),
          this.chalk.grey('It has the Forest skills — the steps are in `deploy-heroku`.'),
        ]);

        return false;
      }

      this.instruct('Deploying needs your coding agent set up first:', [
        `Pick ${this.chalk.cyan(
          '"Teach your coding agent about Forest"',
        )} above, then come back here.`,
        this.chalk.grey(`Prefer to do it by hand? ${DOCS_URL}`),
      ]);
    }

    return false;
  }

  private async offerLaunch(tail: Tail, seed: string): Promise<boolean> {
    const [agent] = StartCommand.launchableAgents(tail.dir);
    if (!agent) return false;
    if (!(await this.confirm(`Launch ${agent.label} here now?`))) return false;

    return this.launch(tail, seed);
  }

  /** Hand the terminal to a coding agent, seeded with a task. False when none was set up. */
  private async launch(tail: Tail, seed: string): Promise<boolean> {
    const [agent] = StartCommand.launchableAgents(tail.dir);
    if (!agent) return false;

    this.logger.log(
      this.chalk.grey(
        `\n  (your Forest back-end keeps running underneath — opening ${agent.label}…)`,
      ),
    );
    // The agent takes over a full-screen terminal; back-end log lines drawn into it corrupt the
    // display for the whole session. It keeps running, we just stop echoing it.
    tail.mute?.();
    await this.run$(agent.bin, [seed], tail.dir);
    stopProcess(tail.child, 'SIGINT');
    this.logger.log(
      this.chalk.grey(`\n  Forest back-end stopped. Restart it: cd ${tail.dir} && ${tail.restart}`),
    );

    return true;
  }

  /** Hold the back-end in the foreground so a closed window is never a dead end. */
  private keepAlive(child: ChildProcess, dir: string, restart: string): Promise<void> {
    this.logger.log(
      this.chalk.grey(
        '\n  ▸ This terminal now runs your back-end (live logs below). Keep it open.',
      ),
    );
    this.logger.log(
      this.chalk.grey(`     Ctrl-C to stop  ·  restart later: cd ${dir} && ${restart}`),
    );

    return new Promise(resolve => {
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        this.logger.log(
          `\n\n${this.chalk.yellow('■')} Back-end stopped. Restart it anytime → ${this.chalk.cyan(
            `cd ${dir} && ${restart}`,
          )}`,
        );
        stopProcess(child, 'SIGINT');
        resolve();
      };
      process.on('SIGINT', stop);
      child.on('exit', () => resolve());
    });
  }

  // ---------- seeds & helpers ----------

  /**
   * What the CLI knows and the coding agent would otherwise have to guess — or guess wrong. Two
   * facts earn their place: the back-end is ALREADY running (a fresh agent's first reflex is to
   * boot it, which collides on the port or kills the live one), and nothing is deployed yet, so no
   * role exists and inviting anyone is premature. Everything durable belongs in the skills.
   */
  private static seed(intent: 'customise' | 'deploy', tail: Tail): string {
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

  /**
   * Which coding agents `skills:init` actually set up, read back from the manifest it just wrote.
   * We deliberately do not detect them here: the toolbelt already does it, better — from the repo's
   * own marks, and knowing Cursor and OpenCode too — and asking twice makes a flow feel like a form.
   */
  /** Whether `skills:init` ran here at all — regardless of which agent it set up. */
  private static hasSkills(dir: string): boolean {
    return fs.existsSync(`${dir}/.forest/skills-manifest.json`);
  }

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

  /**
   * Read the secrets `projects:create:in-app` printed.
   *
   * Two shapes on purpose: the `--format json` document when the CLI supports it, and otherwise
   * the human output, which prints `FOREST_ENV_SECRET=…` ungated for exactly this consumer. The
   * fallback is what makes this work against a CLI that predates the flag rather than dying on
   * `Nonexistent flag: --format`.
   */
  /**
   * Put the secrets where the app reads them from, rather than on the terminal. Existing values
   * are left alone: overwriting a secret the user already configured would be worse than not
   * writing at all.
   */
  private static writeSecrets(secrets: { envSecret?: string; authSecret?: string }): {
    file: string;
    written: string[];
    conflicts: string[];
  } {
    const file = '.env';
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const written: string[] = [];
    const conflicts: string[] = [];
    const appended: string[] = [];
    let content = current;

    Object.entries({
      FOREST_ENV_SECRET: secrets.envSecret,
      FOREST_AUTH_SECRET: secrets.authSecret,
    }).forEach(([key, value]) => {
      if (!value) return;

      const assignment = new RegExp(`^${key}=(.*)$`, 'm');
      const existing = assignment.exec(content)?.[1]?.trim();

      if (existing === undefined) {
        appended.push(`${key}=${value}`);
        written.push(key);
      } else if (existing === '') {
        // A placeholder, not a configured value. Filled IN PLACE: appending would leave the file
        // with the same key twice, which reads as a mistake even though dotenv takes the last.
        content = content.replace(assignment, `${key}=${value}`);
        written.push(key);
      } else if (existing !== value) {
        // A DIFFERENT secret is already there: overwriting it would break whatever it belongs to,
        // and staying silent would leave the app pointing at another project while we report
        // success. Neither is acceptable, so it is surfaced.
        conflicts.push(key);
      }
    });

    if (content !== current || appended.length) {
      const separator = content && !content.endsWith('\n') ? '\n' : '';
      fs.writeFileSync(
        file,
        appended.length ? `${content}${separator}${appended.join('\n')}\n` : content,
      );
    }

    return { file, written, conflicts };
  }

  /** Say what actually happened to the secrets — never the values themselves. */
  private reportSecrets({
    file,
    written,
    conflicts,
  }: {
    file: string;
    written: string[];
    conflicts: string[];
  }): void {
    if (written.length)
      this.logger.success(`${written.join(' and ')} written to ${file} — do not commit it.`);
    if (conflicts.length) {
      this.logger.warn(
        `${conflicts.join(
          ' and ',
        )} already set to a different value in ${file} — left untouched. ` +
          'Your app will keep using the existing project until you replace it.',
      );
    }
    if (!written.length && !conflicts.length) {
      this.logger.warn(`No secret was returned, so nothing was written to ${file}.`);
    }
  }

  private static parseSecrets(output: string): { envSecret?: string; authSecret?: string } {
    try {
      const parsed = JSON.parse(output.trim());
      if (parsed?.envSecret) return parsed;
    } catch {
      // Not JSON — fall through to the human output.
    }

    return {
      envSecret: /FOREST_ENV_SECRET=([0-9a-fA-F]+)/.exec(output)?.[1],
      authSecret: /FOREST_AUTH_SECRET=([0-9a-fA-F]+)/.exec(output)?.[1],
    };
  }

  private doneDemo(name: string): void {
    this.logger.success(
      `Demo back-office live. Open ${this.chalk.cyan(`https://app.forestadmin.com/${name}`)}`,
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
    this.logger.log(
      `  ${this.chalk.bold('Served by →')} http://localhost:${port}   (this terminal)`,
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
