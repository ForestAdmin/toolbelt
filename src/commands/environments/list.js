const { Command, flags } = require('@oclif/command')
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const logger = require('../../services/logger');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environments');
const Prompter = require('../../services/prompter');

class EnvironmentCommand extends Command {
  async run() {
    const { flags } = this.parse(EnvironmentCommand);

    let config = await Prompter([]);
    config = _.merge(config, flags);

    const manager = new EnvironmentManager(config);

    const environments = await manager.listEnvironments();
    new Renderer(config).render(environments);
  }
}

EnvironmentCommand.description = `List existing environments.`;

EnvironmentCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
    required: true
  }),
  format: flags.string({
    char: 'format',
    description: 'Ouput format',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = EnvironmentCommand;

