const { Flags } = require('@oclif/core');

const EnvironmentManager = require('../services/environment-manager');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command').default;
const withCurrentProject = require('../services/with-current-project');

class EnvironmentCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env, environmentsRenderer } = this.context;
    assertPresent({ env, environmentsRenderer });
    this.env = env;
    this.environmentsRenderer = environmentsRenderer;
  }

  async runAuthenticated() {
    const parsed = await this.parse(EnvironmentCommand);
    const config = await withCurrentProject({ ...this.env, ...parsed.flags });
    const manager = new EnvironmentManager(config);
    const environments = await manager.listEnvironments();
    this.environmentsRenderer.render(environments, config);
  }
}

EnvironmentCommand.aliases = ['environments:list'];

EnvironmentCommand.description = 'Manage environments.';

EnvironmentCommand.flags = {
  projectId: Flags.integer({
    char: 'p',
    description: 'Forest project ID.',
    default: null,
  }),
  format: Flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = EnvironmentCommand;
