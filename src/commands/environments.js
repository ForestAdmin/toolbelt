const { flags } = require('@oclif/command');
const context = require('../context');
const EnvironmentManager = require('../services/environment-manager');
const Renderer = require('../renderers/environments');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const withCurrentProject = require('../services/with-current-project');

class EnvironmentCommand extends AbstractAuthenticatedCommand {
  constructor(...args) {
    super(...args);

    const { config } = context.inject();

    this.envConfig = config;

    if (!this.envConfig) throw new Error('Missing dependency envConfig');
  }

  async runIfAuthenticated() {
    const parsed = this.parse(EnvironmentCommand);
    const config = await withCurrentProject({ ...this.envConfig, ...parsed.flags });
    const manager = new EnvironmentManager(config);
    const environments = await manager.listEnvironments();
    new Renderer(config).render(environments);
  }
}

EnvironmentCommand.description = 'Manage environments.';

EnvironmentCommand.flags = {
  projectId: flags.string({
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
