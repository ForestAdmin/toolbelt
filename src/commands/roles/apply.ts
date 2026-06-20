import type { Config } from '@oclif/core';

import { Args, Flags } from '@oclif/core';
import { readFileSync } from 'fs';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import EnvironmentManager from '../../services/environment-manager';
import RoleManager from '../../services/role-manager';
import { computeDiff, formatWide, parseWide } from '../../services/roles-csv';
import withCurrentProject from '../../services/with-current-project';

type NamedEntity = { id: number | string; name: string };

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

    // 2. Resolve environment
    const environments = await new EnvironmentManager(config).listEnvironments();
    const environment = this.resolveEnvByName(environments, flags.env);
    const envId = String(environment.id);

    // 3. Fetch current state for all roles (sequential to avoid hammering the server)
    const roleManager = new RoleManager(config);
    const roleList = await roleManager.listForProject();
    const fullRoles: Array<{ id: string; name: string; permissions: { environments: unknown[] } }> =
      [];
    // eslint-disable-next-line no-restricted-syntax -- sequential: one fetch at a time
    for (const role of roleList) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const full = await roleManager.getRoleById(role.id);
        fullRoles.push(full);
      } catch {
        this.logger.warn(
          `Could not fetch permissions for role "${role.name}" (id: ${role.id}): skipped.`,
        );
      }
    }

    // 4. Parse CSV -> desired state
    const desired = parseWide(csvContent, envId);

    // 5. Build current state in the same shape as parseWide output
    const currentState = parseWide(formatWide(fullRoles, envId), envId).map((r, idx) => ({
      ...r,
      id: fullRoles[idx]?.id,
    }));

    // 6. Compute diff
    const diffs = computeDiff(currentState, desired);

    // 7. Show summary
    diffs.forEach(diff => this.logger.info(`Role ${diff.roleName}: ${diff.ops.length} change(s)`));

    const totalOps = diffs.reduce((sum, d) => sum + d.ops.length, 0);
    if (totalOps === 0) {
      this.logger.info('Nothing to apply.');
      return;
    }

    // 8. Confirm unless --force
    if (!flags.force) {
      const { confirm } = await this.inquirer.prompt([
        {
          message: `Apply ${totalOps} change(s) to environment "${flags.env}"?`,
          name: 'confirm',
          type: 'confirm',
        },
      ]);
      if (!confirm) return;
    }

    // 9. Apply patches (sequential: one role at a time)
    let appliedCount = 0;
    // eslint-disable-next-line no-restricted-syntax -- sequential: apply patches one role at a time
    for (const diff of diffs) {
      if (diff.ops.length === 0) {
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const roleId =
        diff.roleId ??
        // eslint-disable-next-line no-await-in-loop
        (await roleManager.createRole(diff.roleName, config.projectId)).id;
      // eslint-disable-next-line no-await-in-loop
      await roleManager.patchPermissions(roleId, diff.ops);
      appliedCount += 1;
    }

    this.logger.info(`Applied changes to ${appliedCount} role(s).`);
  }
}
