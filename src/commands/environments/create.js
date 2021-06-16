const { flags } = require('@oclif/command');
const defaultPlan = require('../../context/plan');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environment');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const withCurrentProject = require('../../services/with-current-project');

class CreateCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(CreateCommand);
    const config = await withCurrentProject({ ...this.env, ...parsed.flags });
    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.createEnvironment();
      new Renderer(config).render(environment);
    } catch (error) {
      if (error.response && error.status !== 403) {
        const errorData = JSON.parse(error.response.text);
        if (errorData && errorData.errors && errorData.errors.length
          && errorData.errors[0] && errorData.errors[0].detail) {
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
  projectId: flags.integer({
    char: 'p',
    description: 'Forest project ID.',
    default: null,
  }),
  name: flags.string({
    char: 'n',
    description: 'Environment name.',
    required: true,
  }),
  url: flags.string({
    char: 'u',
    description: 'Application URL.',
    required: true,
  }),
  format: flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = CreateCommand;
