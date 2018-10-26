const {Command, flags} = require('@oclif/command')
const _ = require('lodash');
const chalk = require('chalk');
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

    environments.forEach((environment) => {
      console.log(`\t${environment.name}: ${chalk.green(environment.apiEndpoint)} [${chalk.cyan(environment.type)}]`);
    });

    console.log('\n');
  }
}

EnvironmentCommand.description = `List existing environments.`;

EnvironmentCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
  project: flags.string({ char: 'p', description: 'The Forest project name', required: true }),
};

module.exports = EnvironmentCommand;

