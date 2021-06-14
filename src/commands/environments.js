const { flags } = require('@oclif/command');
const makeDefaultPlan = require('../context/plan');
const EnvironmentManager = require('../services/environment-manager');
const Renderer = require('../renderers/environments');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const withCurrentProject = require('../services/with-current-project');

class EnvironmentCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(EnvironmentCommand);
    const config = await withCurrentProject({ ...this.env, ...parsed.flags });
    const manager = new EnvironmentManager(config);
    const environments = await manager.listEnvironments();
    new Renderer(config).render(environments);
  }
}

EnvironmentCommand.description = 'Manage environments.';

EnvironmentCommand.flags = {
  projectId: flags.integer({
    char: 'p',
    description: 'Forest project ID.',
    default: null,
  }),
  format: flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = EnvironmentCommand;
