import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';
import { writeFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { serializeLayoutFile } from '../../services/layout/layout-file';
import LayoutManager from '../../services/layout/layout-manager';
import { PULL_DOMAINS, fetchRemoteDocs, summarize } from '../../services/layout/read';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';

const DEFAULT_OUTPUT = 'forest-layout.json';

/**
 * `forest layout pull` — read the live rendering of an environment/team and
 * write it to a versionable forest-layout.json. First milestone of the
 * declarative layout-as-code flow (pull → diff → apply).
 */
export default class LayoutPullCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  static override description =
    'Pull the layout (rendering) of an environment into a forest-layout.json file.';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description:
        'Environment to pull from (name or id). Defaults to the environment of FOREST_ENV_SECRET ' +
        'when set, otherwise the development environment.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team whose layout to pull (name or id). Defaults to the "Operations" team.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Id of the project (resolved automatically when you only have one).',
    }),
    out: Flags.string({
      char: 'o',
      description: `Output file path (default: ${DEFAULT_OUTPUT}).`,
      default: DEFAULT_OUTPUT,
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  protected async runAuthenticated(): Promise<void> {
    const { flags } = await this.parse(LayoutPullCommand);

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const docs = await fetchRemoteDocs(new LayoutManager(), scope, PULL_DOMAINS);
    const content = serializeLayoutFile(scope, docs, () => new Date());

    const outputPath = path.resolve(process.cwd(), flags.out);
    writeFileSync(outputPath, content);

    const { collections, workflows } = summarize(docs);
    this.logger.success(
      `Pulled the layout of ${this.chalk.bold(scope.environmentName)} / ${this.chalk.bold(
        scope.teamName,
      )} into ${this.chalk.bold(flags.out)} (${collections} collections, ${workflows} workflows).`,
    );
  }
}
