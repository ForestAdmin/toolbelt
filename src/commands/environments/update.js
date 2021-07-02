const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class UpdateCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(UpdateCommand);
    const config = { ...this.env, ...parsed.flags };

    if (config.name || config.url) {
      const manager = new EnvironmentManager(config);
      await manager.updateEnvironment();
      this.logger.info('Environment updated.');
    } else {
      this.logger.error('Please provide environment name and/or url');
    }
  }
}

UpdateCommand.description = 'Update an environment.';

UpdateCommand.flags = {
  environmentId: AbstractAuthenticatedCommand.flags.integer({
    char: 'e',
    description: 'The forest environment ID to update.',
    required: true,
  }),
  name: AbstractAuthenticatedCommand.flags.string({
    char: 'n',
    description: 'To update the environment name.',
    required: false,
  }),
  url: AbstractAuthenticatedCommand.flags.string({
    char: 'u',
    description: 'To update the application URL.',
    required: false,
  }),
};

module.exports = UpdateCommand;
