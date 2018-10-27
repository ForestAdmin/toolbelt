const {Command, flags} = require('@oclif/command')
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const logger = require('../../services/logger');
const EnvironmentManager = require('../../services/environment-manager');
const Prompter = require('../../services/prompter');

class EnvironmentCommand extends Command {
  async run() {
    const {flags} = this.parse(EnvironmentCommand)

    let config = await Prompter([]);
    config = _.merge(config, flags);

    const manager = new EnvironmentManager(config);

    const environments = await manager.listEnvironments();
    console.log(`${chalk.bold('ENVIRONMENTS')}`);

    const table = new Table({
      head: ['ID', 'NAME', 'URL', 'TYPE'],
      colWidths: [10, 20, 35, 15],
      chars: { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
        , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
        , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
        , 'right': '' , 'right-mid': '' , 'middle': '' }
    });

    environments.forEach((environment) => {
      table.push([environment.id, environment.name, environment.apiEndpoint,
        environment.type]);
    });

    console.log(table.toString());
    console.log('\n');
  }
}

EnvironmentCommand.description = `List existing environments.`;

EnvironmentCommand.flags = {
  project: flags.string({
    char: 'p',
    description: 'The Forest project name',
    required: true
  }),
};

module.exports = EnvironmentCommand;

