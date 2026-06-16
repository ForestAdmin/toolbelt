import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { readFileSync } from 'fs';
import path from 'path';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import { LayoutApiError } from '../../services/layout/errors';
import LayoutManager from '../../services/layout/layout-manager';
import { explainApiError, formatPlan } from '../../services/layout/plan-format';
import { resolveCommandScope } from '../../services/layout/resolve-command-scope';
import { diffAllDomains, domainsInFile, fetchRemoteDocs } from '../../services/layout/sync';
import { LAYOUT_DOMAINS } from '../../services/layout/types';
import { parseLayoutFile } from '../../services/layout/yaml-file';

const DEFAULT_FILE = 'forest-layout.yml';

/**
 * `forest layout apply` — compute the JSON-Patch plan between forest-layout.yml
 * and the live rendering, then PATCH it to the environment. Idempotent: an
 * unchanged file produces no operation and sends nothing.
 */
export default class LayoutApplyCommand extends AbstractAuthenticatedCommand {
  private readonly env: { FOREST_SERVER_URL: string } & Record<string, unknown>;

  private readonly inquirer: { prompt(questions: unknown): Promise<{ confirm: boolean }> };

  static override args = {
    file: Args.string({
      default: DEFAULT_FILE,
      description: `Layout file to apply (default: ${DEFAULT_FILE}).`,
      name: 'file',
    }),
  };

  static override description =
    'Apply a forest-layout.yml to an environment (pushes JSON-Patch changes).';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description: 'Environment to apply to (name or id). Defaults to the file header.',
    }),
    team: Flags.string({
      char: 't',
      description: 'Team to apply to (name or id). Defaults to the file header.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Id of the project (defaults to the file header).',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip the confirmation prompt.',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  protected async runAuthenticated(): Promise<void> {
    const { args, flags } = await this.parse(LayoutApplyCommand);

    const filePath = path.resolve(process.cwd(), args.file);
    const { docs, scope: fileScope } = parseLayoutFile(readFileSync(filePath, 'utf8'));

    const scope = await resolveCommandScope({
      baseEnv: this.env,
      fileScope,
      flags: { env: flags.env, projectId: flags.projectId, team: flags.team },
    });

    const manager = new LayoutManager();
    const remote = await fetchRemoteDocs(manager, scope, domainsInFile(docs));
    const { ops, warnings } = diffAllDomains(remote, docs);

    this.log(formatPlan(ops, warnings));

    if (ops.length === 0) {
      this.logger.success('Nothing to apply: the environment already matches the file.');
      return;
    }

    if (!flags.force && !(await this.confirm(scope.environmentName, scope.teamName))) return;

    // One atomic PATCH per domain, in a stable order; ops are already add→replace→remove.
    const domainsToPatch = LAYOUT_DOMAINS.filter(domain => ops.some(op => op.domain === domain));
    try {
      // eslint-disable-next-line no-restricted-syntax -- sequential awaits: domains patched one at a time
      for (const domain of domainsToPatch) {
        // eslint-disable-next-line no-await-in-loop -- intentional: atomic, ordered per-domain patches
        await manager.patchDomain(
          domain,
          ops.filter(op => op.domain === domain),
          scope,
        );
      }
    } catch (error) {
      if (error instanceof LayoutApiError && error.status !== 401) {
        this.logger.error(explainApiError(error, ops));
        this.exit(2);
        return;
      }

      throw error;
    }

    this.logger.success(
      `Applied ${ops.length} change${ops.length > 1 ? 's' : ''} to ${this.chalk.bold(
        scope.environmentName,
      )} / ${this.chalk.bold(scope.teamName)}.`,
    );
  }

  private async confirm(environmentName: string, teamName: string): Promise<boolean> {
    const { confirm } = await this.inquirer.prompt([
      {
        message: `Apply these changes to ${environmentName} / ${teamName}?`,
        name: 'confirm',
        type: 'confirm',
      },
    ]);

    return confirm;
  }
}
