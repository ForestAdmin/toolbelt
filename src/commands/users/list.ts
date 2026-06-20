import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import UserManager from '../../services/user-manager';
import withCurrentProject from '../../services/with-current-project';

export default class UsersListCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  private usersRenderer: { render: (users: unknown[], config: unknown) => void };

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

    const users = await new UserManager(config).listForProject();
    this.usersRenderer.render(users, { ...config, format: flags.format });
  }
}
