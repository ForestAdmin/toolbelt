const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class GetCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const {
      assertPresent,
      chalk,
      env,
      environmentRenderer,
    } = this.context;
    assertPresent({ chalk, env });
    this.chalk = chalk;
    this.env = env;
    this.environmentRenderer = environmentRenderer;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(GetCommand);
    const config = { ...this.env, ...parsed.flags, ...parsed.args };
    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.getEnvironment(config.environmentId);
      this.environmentRenderer.render(environment, config);
    } catch (err) {
      this.logger.error(`Cannot find the environment ${this.chalk.bold(config.environmentId)}.`);
    }
  }
}

GetCommand.description = 'Get the configuration of an environment.';

GetCommand.flags = {
  format: AbstractAuthenticatedCommand.flags.string({
    char: 'format',
    description: 'Output format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

GetCommand.args = [{
  name: 'environmentId', required: true, description: 'ID of an environment.',
}];

module.exports = GetCommand;
