const { Command, flags } = require('@oclif/command');
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environment');
const Prompter = require('../../services/prompter');
const logger = require('../../services/logger');

class GetCommand extends Command {
  async run() {
    const { args } = this.parse(GetCommand);
    const { flags } = this.parse(GetCommand);

    let config = await Prompter([]);
    config = _.merge(config, flags, args);

    const manager = new EnvironmentManager();
    try {
      const environment = await manager.getEnvironment(config);
      new Renderer(config).render(environment);
    } catch (err) {
      logger.error(`Cannot find the environment ${chalk.bold(config.environmentId)} on the project ${chalk.bold(config.projectId)}.`);
    }
  }
}

GetCommand.description = `Get the configuration of an environment`;

GetCommand.flags = {
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

GetCommand.args = [{
  name: 'environmentId', required: true, description: 'ID of an environment'
}];

module.exports = GetCommand;
