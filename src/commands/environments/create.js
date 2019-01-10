const { Command, flags } = require('@oclif/command');
const _ = require('lodash');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environment');
const Prompter = require('../../services/prompter');

class CreateCommand extends Command {
  async run() {
    const parsed = this.parse(CreateCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags);

    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.createEnvironment();
      new Renderer(config).render(environment);
    } catch (error) {
      if (error.response) {
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
      this.error(error, { exit: 1 });
    }
  }
}

CreateCommand.description = 'Create a new environment';

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
