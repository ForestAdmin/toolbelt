const { Command, flags } = require('@oclif/command');
const _ = require('lodash');
const chalk = require('chalk');
const inquirer = require('inquirer');
const EnvironmentManager = require('../../services/environment-manager');
const Prompter = require('../../services/prompter');
const logger = require('../../services/logger');

class DeleteCommand extends Command {
  async run() {
    const parsed = this.parse(DeleteCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags, parsed.args);

    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.getEnvironment(config.environmentId);
      let answers;

      if (!config.force) {
        answers = await inquirer
          .prompt([{
            type: 'input',
            prefix: '⚠️  WARNING \t',
            name: 'confirm',
            message: `This will delete the environment ${chalk.red(environment.name)}.\nTo proceed, type ${chalk.red(environment.name)} or re-run this command with --force : `,
          }]);
      }

      if (!answers || answers.confirm === environment.name) {
        await manager.deleteEnvironment(config.environmentId);
        console.log(`Environment ${chalk.red(environment.name)} successfully deleted.`);
      } else {
        logger.error(`Confirmation did not match ${chalk.red(environment.name)}. Aborted.`);
      }
    } catch (err) {
      if (err.status === 404) {
        logger.error(`Cannot find the environment ${chalk.bold(config.environmentId)} on the project ${chalk.bold(config.projectId)}.`);
      } else {
        throw err;
      }
    }
  }
}

DeleteCommand.description = 'Delete an environment';

DeleteCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
    required: true,
  }),
  force: flags.boolean({
    char: 'force',
    description: 'Force delete',
  }),
};

DeleteCommand.args = [{
  name: 'environmentId', required: true, description: 'ID of an environment',
}];

module.exports = DeleteCommand;
