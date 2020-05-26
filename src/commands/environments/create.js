const { flags } = require('@oclif/command');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environment');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const withCurrentProject = require('../../services/with-current-project');
const envConfig = require('../../config');

class CreateCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const parsed = this.parse(CreateCommand);
    const config = await withCurrentProject({ ...envConfig, ...parsed.flags });
    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.createEnvironment();
      new Renderer(config).render(environment);
    } catch (error) {
      if (error.response && error.status !== 403) {
        const errorData = JSON.parse(error.response.text);
        if (errorData && errorData.errors && errorData.errors.length
          && errorData.errors[0] && errorData.errors[0].detail) {
          this.error(errorData.errors[0].detail, {
            code: errorData.errors[0].status,
            exit: 1,
          });
          return;
        }
      }
      throw error;
    }
  }
}

CreateCommand.description = 'Create a new environment.';

CreateCommand.flags = {
  projectId: flags.string({
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
