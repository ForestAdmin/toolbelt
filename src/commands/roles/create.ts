import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import RoleManager from '../../services/role-manager';
import withCurrentProject from '../../services/with-current-project';

export default class RolesCreateCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  static override description = 'Create a new role in a project.';

  static override flags = {
    name: Flags.string({
      char: 'n',
      description: 'Name of the role to create.',
      required: true,
    }),
    projectId: Flags.integer({
      char: 'p',
      description: 'Forest project ID.',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  async runAuthenticated() {
    const { flags } = await this.parse(RolesCreateCommand);
    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });

    try {
      const role = await new RoleManager(config).createRole(flags.name, config.projectId);
      this.logger.info(`Role "${role.name}" created (id: ${role.id}).`);
    } catch (error) {
      const { response, status } = error as {
        status?: number;
        response?: { text?: string };
      };
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
}
