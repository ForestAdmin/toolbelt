import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { readFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import LayoutManager from '../../services/layout/layout-manager';
import { formatPlan } from '../../services/layout/plan-format';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import {
  diffAllDomains,
  domainsInFile,
  fetchRemoteDocs,
  stepWorkflows,
} from '../../services/layout/sync';
import { parseLayoutFile } from '../../services/layout/yaml-file';

const DEFAULT_FILE = 'forest-layout.yml';

/**
 * `forest layout diff` — compute the JSON-Patch plan between forest-layout.yml
 * and the live rendering, and print it. Writes nothing and sends nothing: this
 * is the dry-run of `forest layout apply`.
 */
export default class LayoutDiffCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  static override args = {
    file: Args.string({
      default: DEFAULT_FILE,
      description: `Layout file to compare (default: ${DEFAULT_FILE}).`,
      name: 'file',
    }),
  };

  static override description =
    'Show the changes that `forest layout apply` would push (dry-run, reads only).';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description: 'Environment to compare against (name or id). Defaults to the file header.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team to compare against (name or id). Defaults to the file header.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Id of the project (defaults to the file header).',
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
    const { docs, scope: fileScope } = parseLayoutFile(readFileSync(filePath, 'utf8'));

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      fileScope,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const remote = await fetchRemoteDocs(new LayoutManager(), scope, domainsInFile(docs));
    const { ops, warnings } = diffAllDomains(remote, docs);

    this.log(
      `Diff of ${this.chalk.bold(args.file)} against ${this.chalk.bold(
        scope.environmentName,
      )} / ${this.chalk.bold(scope.teamName)}:\n`,
    );
    this.log(formatPlan(ops, warnings));
    stepWorkflows(docs).forEach(workflow =>
      this.log(
        `  ⚙ workflow « ${workflow.name} »: would compile + upload BPMN (${workflow.steps.length} steps)`,
      ),
    );
  }
}
