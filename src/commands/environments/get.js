const {Command, flags} = require('@oclif/command')
const _ = require('lodash');
const chalk = require('chalk');
const Table = require('cli-table');
const EnvironmentManager = require('../../services/environment-manager');
const Prompter = require('../../services/prompter');

class GetCommand extends Command {
  async run() {
    const {args} = this.parse(GetCommand)
    const {flags} = this.parse(GetCommand)

    let config = await Prompter([]);
    config = _.merge(config, flags, args);

    const manager = new EnvironmentManager();
    const environment = await manager.getEnvironment(config);

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
  }
}

GetCommand.description = `Describe the command here
...
Extra documentation goes here
`

GetCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
    required: true
  }),
};

GetCommand.args = [{
  name: 'environmentId', required: true, description: 'ID of an environment'
}]

module.exports = GetCommand
