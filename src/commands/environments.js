const { flags } = require('@oclif/command');
const Context = require('@forestadmin/context');
const plan = require('../context/init');
const EnvironmentManager = require('../services/environment-manager');
const Renderer = require('../renderers/environments');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const withCurrentProject = require('../services/with-current-project');

class EnvironmentCommand extends AbstractAuthenticatedCommand {
  init(context) {
    this.context = context || Context.execute(plan);
    const { assertPresent, config } = this.context;
    assertPresent({ config });

    this.envConfig = config;
    super.init();
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
