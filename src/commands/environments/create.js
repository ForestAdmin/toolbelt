const { flags } = require('@oclif/command');
const _ = require('lodash');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environment');
const Prompter = require('../../services/prompter');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const { logError } = require('../../utils');

class CreateCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const parsed = this.parse(CreateCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags);

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
      logError(error, { exit: 1 });
    }
  }
}

CreateCommand.description = 'create a new environment';

CreateCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
    required: true,
  }),
  name: flags.string({
    char: 'n',
    description: 'Environment name',
    required: true,
  }),
  url: flags.string({
    char: 'u',
    description: 'Application URL',
    required: true,
  }),
  format: flags.string({
    char: 'format',
    description: 'Ouput format',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = CreateCommand;
