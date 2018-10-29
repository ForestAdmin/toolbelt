const { Command, flags } = require('@oclif/command')
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const EnvironmentManager = require('../../services/environment-manager');
const Prompter = require('../../services/prompter');
const logger = require('../../services/logger');

class CreateCommand extends Command {
  async run() {
    const {flags} = this.parse(CreateCommand);

    let config = await Prompter([]);
    config = _.merge(config, flags);

    const manager = new EnvironmentManager();

    try {
      const environment = await manager.createEnvironment(config);
      console.log(`${chalk.bold('ENVIRONMENT')}`);

      const table = new Table({
        chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
          , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
          , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
          , 'right': '' , 'right-mid': '' , 'middle': '' }
      });

      table.push(
        { id: environment.id },
        { name: environment.name },
        { url: environment.apiEndpoint },
        { active: environment.isActive },
        { type: environment.type },
        { liana: environment.lianaName },
        { version: environment.lianaVersion },
        { FOREST_ENV_SECRET: environment.secretKey },
      );

      console.log(table.toString());
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
};

module.exports = CreateCommand
