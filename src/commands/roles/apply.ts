import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { readFileSync } from 'fs';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import EnvironmentManager from '../../services/environment-manager';
import RoleManager from '../../services/role-manager';
import { computeDiff, formatWide, parseWide } from '../../services/roles-csv';
import withCurrentProject from '../../services/with-current-project';

type NamedEntity = { id: number | string; name: string };
type FullRole = { id: string; name: string; permissions: { environments: unknown[] } };
type RoleDiff = {
  roleName: string;
  roleId: string | null;
  ops: Array<{ op: string; path: string; value: unknown }>;
};

export default class RolesApplyCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  private inquirer: { prompt: (questions: unknown[]) => Promise<Record<string, unknown>> };

  static override description =
    'Apply a wide-format CSV to update role permissions in an environment.';

  static override args = {
    file: Args.string({
      description: 'Path to the wide-format CSV file.',
      required: true,
    }),
  };

  static override flags = {
    env: Flags.string({
      char: 'e',
      description: 'Environment name to apply to.',
      required: true,
    }),
    force: Flags.boolean({
      char: 'F',
      description: 'Skip confirmation prompt.',
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Forest project ID.',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  private resolveEnvByName(environments: NamedEntity[], name: string): NamedEntity {
    const match = environments.find(e => e.name === name);
    if (match) return match;
    const available = environments.map(e => e.name).join(', ') || '(none)';
    this.logger.error(`Environment "${name}" not found in this project. Available: ${available}.`);
    return this.exit(1);
  }

  async runAuthenticated() {
    const { args, flags } = await this.parse(RolesApplyCommand);

    // 1. Read the CSV file
    let csvContent: string;
    try {
      csvContent = readFileSync(args.file, 'utf8');
    } catch {
      this.logger.error(
        `Cannot read file "${args.file}". Check that the path is correct and the file is readable.`,
      );
      this.exit(1);
      return;
    }

    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });

    try {
      await this.applyCsv(config, csvContent, flags.env, Boolean(flags.force));
    } catch (error) {
      this.surfaceApiError(error);
    }
  }

  private async applyCsv(
    config: { projectId: number | string } & Record<string, unknown>,
    csvContent: string,
    envName: string,
    force: boolean,
  ): Promise<void> {
    const environments = await new EnvironmentManager(config).listEnvironments();
    const environment = this.resolveEnvByName(environments, envName);
    const envId = String(environment.id);

    const roleManager = new RoleManager(config);
    const roleList = await roleManager.listForProject();

    // Write command: the current state must be complete to diff safely, so any
    // per-role fetch failure aborts rather than diffing against a partial baseline.
    const fullRoles: FullRole[] = [];
    // eslint-disable-next-line no-restricted-syntax -- sequential: one fetch at a time
    for (const role of roleList) {
      // eslint-disable-next-line no-await-in-loop
      fullRoles.push(await roleManager.getRoleById(role.id));
    }

    const desired = parseWide(csvContent, envId);
    const diffs = computeDiff(this.buildCurrentState(fullRoles, envId), desired) as RoleDiff[];

    // apply only updates existing roles; creating roles is `roles:create`'s job.
    const unknown = diffs.filter(diff => diff.roleId == null).map(diff => diff.roleName);
    if (unknown.length) {
      this.logger.error(
        `Role(s) not found: ${unknown.join(', ')}. Create them first with \`forest roles:create\`.`,
      );
      this.exit(1);
      return;
    }

    diffs.forEach(diff => this.logger.info(`Role ${diff.roleName}: ${diff.ops.length} change(s)`));
    const totalOps = diffs.reduce((sum, diff) => sum + diff.ops.length, 0);
    if (totalOps === 0) {
      this.logger.info('Nothing to apply.');
      return;
    }

    if (!force && !(await this.confirmApply(totalOps, envName))) {
      this.logger.info('Aborted: no change made.');
      return;
    }

    await this.patchAll(roleManager, diffs);
  }

  // Normalize fetched roles into the parseWide shape, re-pairing ids by NAME (not
  // array index) so a reordering in format/parse can't misattribute them.
  // eslint-disable-next-line class-methods-use-this -- pure helper kept beside its caller
  private buildCurrentState(fullRoles: FullRole[], envId: string): unknown[] {
    const idByName = new Map(fullRoles.map(role => [role.name, role.id]));

    return parseWide(formatWide(fullRoles, envId), envId).map(role => ({
      ...role,
      id: idByName.get(role.name),
    }));
  }

  private async confirmApply(totalOps: number, envName: string): Promise<boolean> {
    const { confirm } = await this.inquirer.prompt([
      {
        message: `Apply ${totalOps} change(s) to environment "${envName}"?`,
        name: 'confirm',
        type: 'confirm',
      },
    ]);

    return Boolean(confirm);
  }

  private async patchAll(
    roleManager: { patchPermissions(roleId: string, ops: unknown[]): Promise<void> },
    diffs: RoleDiff[],
  ): Promise<void> {
    let applied = 0;
    try {
      // eslint-disable-next-line no-restricted-syntax -- sequential: one role at a time
      for (const diff of diffs) {
        // eslint-disable-next-line no-continue
        if (diff.ops.length === 0) continue;
        // roleId is non-null here: unknown roles were rejected above.
        // eslint-disable-next-line no-await-in-loop
        await roleManager.patchPermissions(diff.roleId as string, diff.ops);
        applied += 1;
      }
    } catch (error) {
      this.logger.warn(
        `Applied ${applied} role(s) before the error — \`forest roles:apply\` is idempotent, re-run to converge.`,
      );
      throw error;
    }

    this.logger.info(`Applied changes to ${applied} role(s).`);
  }

  private surfaceApiError(error: unknown): void {
    // 401/403 keep flowing to the authenticated-command handler.
    const { response, status } = error as { status?: number; response?: { text?: string } };
    if (response && status !== 401 && status !== 403 && response.text) {
      let detail;
      try {
        detail = JSON.parse(response.text)?.errors?.[0]?.detail;
      } catch {
        // Non-JSON error body: fall through and rethrow the original error.
      }
      if (detail) {
        this.logger.error(detail);
        this.exit(1);
        return;
      }
    }

    throw error;
  }
}
