const defaultPlan = require('../context/plan');
const EnvironmentManager = require('../services/environment-manager');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const withCurrentProject = require('../services/with-current-project');

class EnvironmentCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const { assertPresent, env, environmentsRenderer } = this.context;
    assertPresent({ env, environmentsRenderer });
    this.env = env;
    this.environmentsRenderer = environmentsRenderer;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(EnvironmentCommand);
    const config = await withCurrentProject({ ...this.env, ...parsed.flags });
    const manager = new EnvironmentManager(config);
    const environments = await manager.listEnvironments();
    this.environmentsRenderer.render(environments, config);
  }
}

EnvironmentCommand.aliases = ['environments:list'];

EnvironmentCommand.description = 'Manage environments.';

EnvironmentCommand.flags = {
  projectId: AbstractAuthenticatedCommand.flags.integer({
    char: 'p',
    description: 'Forest project ID.',
    default: null,
  }),
  format: AbstractAuthenticatedCommand.flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = EnvironmentCommand;
