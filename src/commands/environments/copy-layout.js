const { Command, flags } = require('@oclif/command');
const _ = require('lodash');
const chalk = require('chalk');
const inquirer = require('inquirer');
const EnvironmentManager = require('../../services/environment-manager');
const Prompter = require('../../services/prompter');
const logger = require('../../services/logger');

class CopyLayoutCommand extends Command {
  async run() {
    const parsed = this.parse(CopyLayoutCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags, parsed.args);

    const manager = new EnvironmentManager(config);
    let fromEnvironment;
    let toEnvironment;
    let answers;

    try {
      fromEnvironment = await manager.getEnvironment(config.fromEnvironment);
    } catch (err) {
      logger.error(`Cannot find the source environment ${chalk.bold(config.fromEnvironment)} on the project ${chalk.bold(config.projectId)}.`);
      process.exit(1);
    }

    try {
      toEnvironment = await manager.getEnvironment(config.toEnvironment);
    } catch (err) {
      logger.error(`Cannot find the target environment ${chalk.bold(config.toEnvironment)} on the project ${chalk.bold(config.projectId)}.`);
      process.exit(1);
    }

    if (!config.force) {
      answers = await inquirer
        .prompt([{
          type: 'input',
          prefix: '⚠️  WARNING \t',
          name: 'confirm',
          message: `This will copy the environment's layout from ${chalk.red(fromEnvironment.name)} to ${chalk.red(toEnvironment.name)} and override the whole previous configuration.\nTo proceed, type ${chalk.red(toEnvironment.name)} or re-run this command with --force : `,
        }]);
    }

    if (!answers || answers.confirm === toEnvironment.name) {
      await manager.copyLayout(fromEnvironment.id, toEnvironment.id);
      console.log(`Environment's layout ${chalk.red(fromEnvironment.name)} successfully copied to ${chalk.red(toEnvironment.name)}.`);
    } else {
      logger.error(`Confirmation did not match ${chalk.red(toEnvironment.name)}. Aborted.`);
    }
  }
}

CopyLayoutCommand.description = 'Copy the layout from one environment to another.';

CopyLayoutCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
    required: true,
  }),
  force: flags.boolean({
    char: 'force',
    description: 'Force copy',
  }),
};

CopyLayoutCommand.args = [
  { name: 'fromEnvironment', required: true, description: 'Source environment ID' },
  { name: 'toEnvironment', required: true, description: 'Target environment ID' },
];

module.exports = CopyLayoutCommand;
