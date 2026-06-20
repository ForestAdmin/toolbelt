import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';
import { writeFileSync } from 'fs';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import EnvironmentManager from '../../services/environment-manager';
import RoleManager from '../../services/role-manager';
import { formatWide } from '../../services/roles-csv';
import withCurrentProject from '../../services/with-current-project';

type NamedEntity = { id: number | string; name: string };

export default class RolesExportCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  static override description = 'Export all roles and their permissions to a wide CSV file.';

  static override flags = {
    env: Flags.string({
      char: 'e',
      description: 'Environment name to export permissions for.',
      required: true,
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Forest project ID.',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path (default: stdout).',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  private resolveEnvByName(environments: NamedEntity[], name: string): NamedEntity {
    const match = environments.find(e => e.name === name);
    if (match) return match;
    const available = environments.map(e => e.name).join(', ') || '(none)';
    this.logger.error(`Environment "${name}" not found in this project. Available: ${available}.`);
    return this.exit(1);
  }

  async runAuthenticated() {
    const { flags } = await this.parse(RolesExportCommand);
    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });

    const environments = await new EnvironmentManager(config).listEnvironments();
    const environment = this.resolveEnvByName(environments, flags.env);

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
      } catch (error) {
        this.logger.warn(
          `Could not fetch permissions for role "${role.name}" (id: ${role.id}): skipped.`,
        );
      }
    }

    const csv = formatWide(fullRoles, environment.id);

    if (flags.output) {
      writeFileSync(flags.output, csv, 'utf8');
      process.stderr.write(`Exported ${fullRoles.length} role(s) to ${flags.output}.\n`);
    } else {
      process.stdout.write(csv);
      process.stderr.write(`Exported ${fullRoles.length} role(s).\n`);
    }
  }
}
