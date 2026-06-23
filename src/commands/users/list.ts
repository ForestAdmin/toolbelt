import type { ProjectUser } from '../../services/user-manager';
import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import UserManager from '../../services/user-manager';
import withCurrentProject from '../../services/with-current-project';

export default class UsersListCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  private usersRenderer: {
    render: (users: ProjectUser[], config: { format: string } & Record<string, unknown>) => void;
  };

  static override description = 'List all users of a project.';

  static override flags = {
    projectId: Flags.integer({
      char: 'p',
      description: 'Forest project ID.',
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format.',
      options: ['table', 'json'],
      default: 'table',
    }),
  };

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config, plan);
    const { assertPresent, env, usersRenderer } = this.context;
    assertPresent({ env, usersRenderer });
    this.env = env;
    this.usersRenderer = usersRenderer;
  }

  async runAuthenticated() {
    const { flags } = await this.parse(UsersListCommand);
    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });

    try {
      const users = await new UserManager(config).listForProject();
      this.usersRenderer.render(users, { ...config, format: flags.format });
    } catch (error) {
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
        }
      }

      throw error;
    }
  }
}
