import type { Config } from '../../../interfaces/project-create-interface';
import type { CommandOptions } from '../../../utils/option-parser';

import { Flags } from '@oclif/core';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import * as projectCreateOptions from '../../../services/projects/create/options';
import { optionsToFlags } from '../../../utils/option-parser';

/**
 * Register a Forest Admin project for an app the user hosts themselves (in-app:
 * Rails, Express, NestJS, …). Unlike create:sql/demo/nosql, this does NOT
 * scaffold an agent and does NOT introspect a database — the schema is pushed by
 * the user's own running agent on first boot. It just creates the project (with
 * `architecture: 'in-app'`), and prints the environment secret to plug into the
 * existing app.
 */
export default class InAppCommand extends AbstractProjectCreateCommand {
  protected static options: CommandOptions = {
    // The URL/port where the user's app runs — used for the dev environment endpoint.
    applicationHost: projectCreateOptions.applicationHost,
    applicationPort: {
      ...projectCreateOptions.applicationPort,
      // 3310 is where scaffolded microservice agents run; here the agent lives in
      // the user's own app (Rails/Express/NestJS, …), which typically runs on 3000.
      default: '3000',
      // …and that app already exists, hence "is running" (not "will be").
      prompter: { question: "What's the port on which your application is running?" },
    },
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = {
    ...optionsToFlags(this.options),
    format: Flags.string({
      description:
        'Output format. With `json`, stdout carries only a machine-readable ' +
        '`{"projectId", "envSecret", "authSecret", "endpoint"}` document.',
      options: ['text', 'json'],
      default: 'text',
    }),
  };

  static override readonly description =
    'Register a project for an app you host yourself (in-app) and print its environment secret — no scaffold, no database.';

  // In-app users bring their own agent (Rails gem, @forestadmin/agent, …), so no
  // agent is sent (see getConfig): the server forces architecture=microservice
  // whenever an agent is present, exactly as the web UI avoids by omitting it.
  protected readonly agent = null;

  // In-app: no DB introspection (the running agent pushes the schema itself)…
  protected override readonly requiresDatabase = false;

  // …and the project is hosted inside the user's app, not a scaffolded microservice.
  protected override readonly architecture = 'in-app';

  private forestEnvSecret?: string;

  private forestAuthSecret?: string;

  // Set in run(), before anything can write: see the ordering note there.
  private jsonOutput = false;

  // Nothing may prompt in JSON mode — inquirer writes its questions to stdout and
  // waits on stdin, which no caller of `--format json` is there to answer.
  protected override get interactive(): boolean {
    return !this.jsonOutput;
  }

  /**
   * `--format json` promises that stdout carries nothing but the JSON document, so
   * the promise has to be installed before the FIRST thing that can write — and that
   * is the login check in AbstractAuthenticatedCommand.run(), not getConfig(). Hence
   * parsing the flag here rather than in getCommandOptions().
   */
  override async run(): Promise<void> {
    const { flags } = await this.parse(InAppCommand);
    this.jsonOutput = flags.format === 'json';

    if (this.jsonOutput) {
      // Everything human-readable is diverted to stderr from now on; stdout is left
      // to logNextSteps(). Diagnostics and errors are not lost, only moved.
      this.logger.reserveStdout = true;

      // The login flow is interactive: refuse up front instead of hanging on a
      // password prompt (and exit 10, the same code checkAuthentication uses).
      if (!this.authenticator.getAuthToken()) {
        this.logger.error(
          `Not logged in. Run '${this.chalk.bold('forest login')}' before using --format json.`,
        );

        return this.exit(10);
      }
    }

    return super.run();
  }

  // Create the project WITHOUT an agent (like the web UI) so the server keeps
  // architecture='in-app'. The abstract otherwise falls back agent → express-sequelize.
  protected override async getConfig() {
    const config = await super.getConfig();

    // Load-bearing null, not an omission: the server forces architecture back to
    // 'microservice' whenever a non-null agent is sent, so sending architecture
    // 'in-app' alone is silently ignored. Both halves are required.
    config.meta.agent = null as unknown as string;

    return config;
  }

  // Required by the abstract command, but in-app scaffolds nothing.
  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-empty-function -- intentional no-op
  protected override async dump(): Promise<void> {}

  // Skip file generation entirely; keep the secrets to surface in logNextSteps().
  protected override async generateProject(config: Config): Promise<void> {
    this.forestEnvSecret = config.forestEnvSecret;
    this.forestAuthSecret = config.forestAuthSecret;

    // The secrets ARE the deliverable here — nothing was scaffolded to fall back on.
    // Checked before the success path runs, so we never claim success and then print
    // `FOREST_ENV_SECRET=undefined` (text) or drop the key altogether (json, where
    // JSON.stringify omits undefined and the caller would see a valid-looking
    // document with exit 0).
    if (!this.forestEnvSecret || !this.forestAuthSecret) {
      const { projectId } = this.context.eventSender.meta;

      throw new Error(
        `The project was created (id: ${projectId ?? 'unknown'}), but Forest did not ` +
          'return its environment secret. Read it from the project settings in the ' +
          'Forest Admin UI.',
      );
    }
  }

  protected override logNextSteps(): void {
    if (this.jsonOutput) {
      // The abstract command stores the created project id on the (singleton)
      // eventSender meta; read it back from there rather than refactoring it.
      const { projectId } = this.context.eventSender.meta;

      // Machine-readable contract (what `npx forest-start` parses): stdout carries
      // ONLY this JSON document — logger lines are diverted to stderr, spinners
      // already write there, and nothing prompts — so callers can JSON.parse the
      // whole of stdout.
      this.context.stdout.write(
        `${JSON.stringify({
          // A JSON:API id is a string on the wire, and the deserializer passes it
          // through uncoerced. Pinned here so the contract does not follow the server.
          projectId: projectId === undefined ? undefined : String(projectId),
          envSecret: this.forestEnvSecret,
          authSecret: this.forestAuthSecret,
          endpoint: this.registeredEndpoint,
        })}\n`,
      );

      return;
    }

    this.logger.info('In-app project created — no code was scaffolded.');
    // Human-oriented output: scripts should use `--format json` instead (stable,
    // parsable). FOREST_AUTH_SECRET is a value you own (any random string works);
    // FOREST_ENV_SECRET is the sensitive one.
    this.logger.info('Set these on your app, then mount the Forest agent in your server:');
    // Straight to stdout rather than through the logger: `SILENT` drops every logger
    // line, and this is the only place the command ever hands over the secrets. Losing
    // them leaves a created project whose secret is reachable only from the UI.
    this.context.stdout.write(`  FOREST_ENV_SECRET=${this.forestEnvSecret}\n`);
    this.context.stdout.write(
      `  FOREST_AUTH_SECRET=${this.forestAuthSecret}   (you own this one — keep it or set your own)\n`,
    );
    // Travels with the secrets rather than through the logger, for the same reason:
    // under `SILENT` a logger line disappears, and secrets delivered without the
    // warning are worse than not delivered at all.
    this.context.stdout.write(
      `${this.chalk.yellow(
        '  ⚠ These are secrets — keep them out of version control and shared CI logs.',
      )}\n`,
    );
    // The 5 gems are all required: forest_admin_rails does not declare its companions as
    // runtime deps, so `gem 'forest_admin_rails'` alone installs but fails to boot.
    this.logger.info(
      `Rails:   add the 5 Forest gems to your Gemfile — ${this.chalk.bold(
        'forest_admin_rails, forest_admin_agent, forest_admin_datasource_toolkit, ' +
          'forest_admin_datasource_customizer, forest_admin_datasource_active_record',
      )},`,
    );
    this.logger.info(
      `         then ${this.chalk.bold('bundle install')} and ${this.chalk.bold(
        'rails g forest_admin_rails:install $FOREST_ENV_SECRET',
      )}`,
    );
    this.logger.info(
      `Node.js: ${this.chalk.bold(
        'npm install @forestadmin/agent',
      )} + a datasource package, then mount it on your server (createAgent(...).mountOnExpress(app).start()).`,
    );
    this.logger.info('On first boot your agent pushes its schema and your admin panel goes live.');
  }
}
