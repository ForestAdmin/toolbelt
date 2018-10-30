const { Command, flags } = require('@oclif/command');
const _ = require('lodash');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environments');
const Prompter = require('../../services/prompter');

class EnvironmentCommand extends Command {
  async run() {
    const parsed = this.parse(EnvironmentCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags);

    const manager = new EnvironmentManager(config);

    const environments = await manager.listEnvironments();
    new Renderer(config).render(environments);
  }
}

EnvironmentCommand.description = 'List existing environments.';

EnvironmentCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
    required: true,
  }),
  format: flags.string({
    char: 'format',
    description: 'Ouput format',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = EnvironmentCommand;

