const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command').default;
const EnvironmentManager = require('../../services/environment-manager');
const withCurrentProject = require('../../services/with-current-project');

class CopyLayoutCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, chalk, env, inquirer } = this.context;
    assertPresent({
      chalk,
      env,
      inquirer,
    });
    this.chalk = chalk;
    this.env = env;
    this.inquirer = inquirer;
  }

  async _getEnvironments(manager, config) {
    let fromEnvironment;
    let toEnvironment;
    try {
      fromEnvironment = await manager.getEnvironment(config.fromEnvironment);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      this.logger.error(
        `Cannot find the source environment ${this.chalk.bold(
          config.fromEnvironment,
        )} on the project ${this.chalk.bold(config.projectId)}.`,
      );
      this.exit(3);
    }

    try {
      toEnvironment = await manager.getEnvironment(config.toEnvironment);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      this.logger.error(
        `Cannot find the target environment ${this.chalk.bold(
          config.toEnvironment,
        )} on the project ${this.chalk.bold(config.projectId)}.`,
      );
      this.exit(3);
    }

    return { fromEnvironment, toEnvironment };
  }

  async runAuthenticated() {
    const oclifExit = this.exit.bind(this);
    const parsed = this.parse(CopyLayoutCommand);
    const config = await withCurrentProject({ ...this.env, ...parsed.flags, ...parsed.args });
    const manager = new EnvironmentManager(config);

    const { fromEnvironment, toEnvironment } = await this._getEnvironments(manager, config);
    let answers;

    if (!config.force) {
      answers = await this.inquirer.prompt([
        {
          type: 'input',
          prefix: 'Δ WARNING \t',
          name: 'confirm',
          message: `This will copy the environment's layout from ${this.chalk.red(
            fromEnvironment.name,
          )} to ${this.chalk.red(
            toEnvironment.name,
          )} and override the whole previous configuration.\nTo proceed, type ${this.chalk.red(
            toEnvironment.name,
          )} or re-run this command with --force : `,
        },
      ]);
    }

    try {
      if (!answers || answers.confirm === toEnvironment.name) {
        const copyLayout = await manager.copyLayout(
          fromEnvironment.id,
          toEnvironment.id,
          oclifExit,
        );
        if (copyLayout) {
          this.logger.log(
            `Environment's layout ${this.chalk.red(
              fromEnvironment.name,
            )} successfully copied to ${this.chalk.red(toEnvironment.name)}.`,
          );
        } else {
          this.logger.error('Oops, something went wrong.');
          this.exit(1);
        }
      } else {
        this.logger.error(
          `Confirmation did not match ${this.chalk.red(toEnvironment.name)}. Aborted.`,
        );
        this.exit(2);
      }
    } catch (error) {
      if (error.status === 403) {
        this.logger.error(
          `You do not have the rights to copy the layout of the environment ${this.chalk.bold(
            fromEnvironment.name,
          )} to ${this.chalk.bold(toEnvironment.name)}.`,
        );
      } else {
        this.logger.error(error);
      }
      this.exit(1);
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
