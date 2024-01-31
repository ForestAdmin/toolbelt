const { Flags } = require('@oclif/core');
const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command').default;
const withCurrentProject = require('../../services/with-current-project');

class CreateCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env, environmentRenderer } = this.context;
    assertPresent({ env, environmentRenderer });
    this.env = env;
    this.environmentRenderer = environmentRenderer;
  }

  async runAuthenticated() {
    const parsed = this.parse(CreateCommand);
    const config = await withCurrentProject({ ...this.env, ...parsed.flags });
    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.createEnvironment();
      this.environmentRenderer.render(environment, config);
    } catch (error) {
      if (error.response && error.status !== 403) {
        const errorData = JSON.parse(error.response.text);
        if (
          errorData &&
          errorData.errors &&
          errorData.errors.length &&
          errorData.errors[0] &&
          errorData.errors[0].detail
        ) {
          this.logger.error(errorData.errors[0].detail);
          this.exit(1);
        }
      }
      throw error;
    }
  }
}

CreateCommand.description = 'Create a new environment.';

CreateCommand.flags = {
  projectId: Flags.integer({
    char: 'p',
    description: 'Forest project ID.',
    default: null,
  }),
  name: Flags.string({
    char: 'n',
    description: 'Environment name.',
    required: true,
  }),
  url: Flags.string({
    char: 'u',
    description: 'Application URL.',
    required: true,
  }),
  format: Flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
  disableRoles: Flags.boolean({
    description: 'Disable roles on new environment.',
    default: false,
  }),
};

module.exports = CreateCommand;
