import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { readFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { parseLayoutFile } from '../../services/layout/layout-file';
import LayoutManager from '../../services/layout/layout-manager';
import { formatPlan } from '../../services/layout/plan-format';
import { fetchRemoteDocs } from '../../services/layout/read';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import { diffAllDomains, domainsInFile } from '../../services/layout/sync';

/**
 * `forest layout diff` — compute the JSON-Patch plan between a forest-layout.json
 * and the live environment, and print it. Writes nothing and sends nothing: this
 * is the dry-run of `forest layout apply`.
 */
export default class LayoutDiffCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  static override args = {
    file: Args.string({
      description: 'Layout file to diff (e.g. forest-layout.json).',
      name: 'file',
      required: true,
    }),
  };

  static override description =
    'Show the changes that `forest layout apply` would push (dry-run, reads only).';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description: 'Environment to compare against (name or id). Prompted if omitted.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team to compare against (name or id). Prompted if omitted.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Id of the project (resolved/prompted when omitted).',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  protected async runAuthenticated(): Promise<void> {
    const { args, flags } = await this.parse(LayoutDiffCommand);

    const filePath = path.resolve(process.cwd(), args.file);
    const { docs } = parseLayoutFile(readFileSync(filePath, 'utf8'));

    // The file header is provenance only: the target env/team is chosen here
    // (flags or interactive prompt), never defaulted to where the file was pulled from.
    const scope = await resolveCommandScope({
      baseEnv: this.env,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const manager = new LayoutManager();
    const remote = await fetchRemoteDocs(manager, scope, domainsInFile(docs));
    const { ops, warnings } = diffAllDomains(remote, docs);

    this.log(
      `Diff of ${this.chalk.bold(args.file)} against ${this.chalk.bold(
        scope.environmentName,
      )} / ${this.chalk.bold(scope.teamName)}:\n`,
    );
    this.log(formatPlan(ops, warnings));
  }
}
