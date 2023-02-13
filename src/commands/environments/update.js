const { flags } = require('@oclif/command');
const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command').default;

class UpdateCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  async run() {
    await this.checkAuthentication();

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

  async catch(error) {
    await this.handleAuthenticationErrors(error);
    return super.catch(error);
  }
}

UpdateCommand.description = 'Update an environment.';

UpdateCommand.flags = {
  environmentId: flags.integer({
    char: 'e',
    description: 'The forest environment ID to update.',
    required: true,
  }),
  name: flags.string({
    char: 'n',
    description: 'To update the environment name.',
    required: false,
  }),
  url: flags.string({
    char: 'u',
    description: 'To update the application URL.',
    required: false,
  }),
};

module.exports = UpdateCommand;
