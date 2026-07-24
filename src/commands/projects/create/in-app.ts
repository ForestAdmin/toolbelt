import type { Config } from '../../../interfaces/project-create-interface';
import type { CommandOptions } from '../../../utils/option-parser';
import type { Config as OclifConfig } from '@oclif/core';

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
    applicationPort: projectCreateOptions.applicationPort,
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

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

  // Create the project WITHOUT an agent (like the web UI) so the server keeps
  // architecture='in-app'. The abstract otherwise falls back agent → express-sequelize.
  protected override async getConfig() {
    const config = await super.getConfig();
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
  }

  protected override logNextSteps(): void {
    this.logger.info('In-app project created — no code was scaffolded.');
    // Printed (not TTY-gated) on purpose: `npx forest-start` reads these back from stdout to wire
    // the app, so gating on isTTY would break it. FOREST_AUTH_SECRET is a value you own (any random
    // string works); FOREST_ENV_SECRET is the sensitive one.
    this.logger.info('Set these on your app, then mount the Forest agent in your server:');
    this.logger.info(`  FOREST_ENV_SECRET=${this.forestEnvSecret}`);
    this.logger.info(
      `  FOREST_AUTH_SECRET=${this.forestAuthSecret}   (you own this one — keep it or set your own)`,
    );
    this.logger.info(
      this.chalk.yellow(
        '  ⚠ These are secrets — keep them out of version control and shared CI logs.',
      ),
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
