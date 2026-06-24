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

    try {
      await this.exportRoles(config, flags.env, flags.output);
    } catch (error) {
      this.surfaceApiError(error);
    }
  }

  private async exportRoles(
    config: { projectId: number | string } & Record<string, unknown>,
    envName: string,
    output?: string,
  ): Promise<void> {
    const environments = await new EnvironmentManager(config).listEnvironments();
    const environment = this.resolveEnvByName(environments, envName);

    const roleManager = new RoleManager(config);
    const roleList = await roleManager.listForProject();

    const fullRoles: Array<{ id: string; name: string; permissions: { environments: unknown[] } }> =
      [];
    let failures = 0;
    // eslint-disable-next-line no-restricted-syntax -- sequential: one fetch at a time
    for (const role of roleList) {
      try {
        // eslint-disable-next-line no-await-in-loop
        fullRoles.push(await roleManager.getRoleById(role.id));
      } catch (error) {
        const { status } = error as { status?: number };
        // Auth / server / network failures are fatal; only a per-role 4xx is skippable.
        if (status === undefined || status === 401 || status === 403 || status >= 500) throw error;
        failures += 1;
        this.logger.warn(
          `Could not fetch permissions for role "${role.name}" (id: ${role.id}): skipped (HTTP ${status}).`,
        );
      }
    }

    if (roleList.length > 0 && fullRoles.length === 0) {
      this.logger.error(`Could not fetch permissions for any of the ${roleList.length} role(s).`);
      this.exit(1);
      return;
    }
    if (failures > 0) {
      this.logger.warn(`${failures} of ${roleList.length} role(s) could not be exported.`);
    }

    this.writeOutput(formatWide(fullRoles, environment.id), output, fullRoles.length);
  }

  private writeOutput(csv: string, output: string | undefined, count: number): void {
    if (!output) {
      process.stdout.write(csv);
      process.stderr.write(`Exported ${count} role(s).\n`);
      return;
    }

    try {
      writeFileSync(output, csv, 'utf8');
    } catch (error) {
      this.logger.error(`Could not write export to "${output}": ${(error as Error).message}.`);
      this.exit(1);
      return;
    }
    process.stderr.write(`Exported ${count} role(s) to ${output}.\n`);
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
