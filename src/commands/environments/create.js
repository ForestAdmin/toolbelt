const { Command, flags } = require('@oclif/command')
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environment');
const Prompter = require('../../services/prompter');
const logger = require('../../services/logger');

class CreateCommand extends Command {
  async run() {
    const { flags } = this.parse(CreateCommand);

    let config = await Prompter([]);
    config = _.merge(config, flags);

    const manager = new EnvironmentManager();

    try {
      const environment = await manager.createEnvironment(config);
      new Renderer(config).render(environment);
    } catch (err) {
      logger.error(err);
    }
  }
}

CreateCommand.description = `Create a new environment`;

CreateCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
    required: true
  }),
  name: flags.string({
    char: 'n',
    description: 'Environment name',
    required: true
  }),
  url: flags.string({
    char: 'u',
    description: 'Application URL',
    required: true
  }),
  format: flags.string({
    char: 'format',
    description: 'Ouput format',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = CreateCommand
