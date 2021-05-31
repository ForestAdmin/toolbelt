const { flags } = require('@oclif/command');
const chalk = require('chalk');
const inquirer = require('inquirer');
const Context = require('@forestadmin/context');
const plan = require('../../context/init');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const EnvironmentManager = require('../../services/environment-manager');
const withCurrentProject = require('../../services/with-current-project');
const logger = require('../../services/logger');

class CopyLayoutCommand extends AbstractAuthenticatedCommand {
  init(context) {
    this.context = context || Context.execute(plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;

    super.init();
  }

  async runIfAuthenticated() {
    const oclifExit = this.exit.bind(this);
    const parsed = this.parse(CopyLayoutCommand);
    const config = await withCurrentProject({ ...this.env, ...parsed.flags, ...parsed.args });
    const manager = new EnvironmentManager(config);

    let fromEnvironment;
    let toEnvironment;
    let answers;

    try {
      fromEnvironment = await manager.getEnvironment(config.fromEnvironment);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      logger.error(`Cannot find the source environment ${chalk.bold(config.fromEnvironment)} on the project ${chalk.bold(config.projectId)}.`);
      this.exit(3);
    }

    try {
      toEnvironment = await manager.getEnvironment(config.toEnvironment);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      logger.error(`Cannot find the target environment ${chalk.bold(config.toEnvironment)} on the project ${chalk.bold(config.projectId)}.`);
      this.exit(3);
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

    try {
      if (!answers || answers.confirm === toEnvironment.name) {
        const copyLayout = await manager.copyLayout(
          fromEnvironment.id,
          toEnvironment.id,
          oclifExit,
        );
        if (copyLayout) {
          return this.log(`Environment's layout ${chalk.red(fromEnvironment.name)} successfully copied to ${chalk.red(toEnvironment.name)}.`);
        }
        logger.error('Oops, something went wrong.');
        return this.exit(1);
      }
      logger.error(`Confirmation did not match ${chalk.red(toEnvironment.name)}. Aborted.`);
      return this.exit(2);
    } catch (error) {
      if (error.status === 403) {
        logger.error(`You do not have the rights to copy the layout of the environment ${chalk.bold(fromEnvironment.name)} to ${chalk.bold(toEnvironment.name)}.`);
        return this.exit(1);
      }
      logger.error(error);
      return this.exit(1);
    }
  }
}

CopyLayoutCommand.description = 'Copy the layout from one environment to another.';

CopyLayoutCommand.flags = {
  projectId: flags.integer({
    char: 'p',
    description: 'Forest project ID.',
    default: null,
  }),
  force: flags.boolean({
    char: 'force',
    description: 'Force copy.',
  }),
};

CopyLayoutCommand.args = [
  { name: 'fromEnvironment', required: true, description: 'Source environment ID.' },
  { name: 'toEnvironment', required: true, description: 'Target environment ID.' },
];

module.exports = CopyLayoutCommand;
