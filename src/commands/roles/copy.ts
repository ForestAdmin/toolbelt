import type { Config } from '@oclif/core';

import { Flags } from '@oclif/core';

import AbstractAuthenticatedCommand from '../../abstract-authenticated-command';
import EnvironmentManager from '../../services/environment-manager';
import RoleManager from '../../services/role-manager';
import withCurrentProject from '../../services/with-current-project';

type NamedEntity = { id: number | string; name: string };

export default class RolesCopyCommand extends AbstractAuthenticatedCommand {
  private env: Record<string, string>;

  static override description = 'Copy role permissions from one environment to another.';

  static override flags = {
    from: Flags.string({
      char: 'f',
      description: 'Source environment name.',
      required: true,
    }),
    to: Flags.string({
      char: 't',
      description: 'Destination environment name.',
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

  private resolveEnvByName(environments: NamedEntity[], name: string): NamedEntity {
    const match = environments.find(e => e.name === name);
    if (match) return match;
    const available = environments.map(e => e.name).join(', ') || '(none)';
    this.logger.error(`Environment "${name}" not found in this project. Available: ${available}.`);
    return this.exit(1);
  }

  async runAuthenticated() {
    const { flags } = await this.parse(RolesCopyCommand);
    const config = await withCurrentProject({ ...this.env, projectId: flags.projectId });

    const environments = await new EnvironmentManager(config).listEnvironments();
    const fromEnv = this.resolveEnvByName(environments, flags.from);
    const toEnv = this.resolveEnvByName(environments, flags.to);

    await new RoleManager(config).copyPermissions(fromEnv.id, toEnv.id);
    this.logger.info(`Permissions copied from "${flags.from}" to "${flags.to}".`);
  }
}
