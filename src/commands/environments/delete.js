const { flags } = require('@oclif/command');
const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command').default;

class DeleteCommand extends AbstractAuthenticatedCommand {
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

  async run() {
    await this.checkAuthentication();

    const parsed = this.parse(DeleteCommand);
    const config = { ...this.env, ...parsed.flags, ...parsed.args };
    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.getEnvironment(config.environmentId);
      let answers;

      if (!config.force) {
        answers = await this.inquirer.prompt([
          {
            type: 'input',
            prefix: 'Δ WARNING \t',
            name: 'confirm',
            message: `This will delete the environment ${this.chalk.red(
              environment.name,
            )}.\nTo proceed, type ${this.chalk.red(
              environment.name,
            )} or re-run this command with --force : `,
          },
        ]);
      }

      if (!answers || answers.confirm === environment.name) {
        try {
          await manager.deleteEnvironment(config.environmentId);
          this.logger.log(`Environment ${this.chalk.red(environment.name)} successfully deleted.`);
        } catch (error) {
          this.logger.error('Oops, something went wrong.');
          this.exit(1);
        }
      } else {
        this.logger.error(
          `Confirmation did not match ${this.chalk.red(environment.name)}. Aborted.`,
        );
        this.exit(1);
      }
    } catch (err) {
      if (err.status === 404) {
        this.logger.error(`Cannot find the environment ${this.chalk.bold(config.environmentId)}.`);
        this.exit(1);
      } else if (err.status === 403) {
        this.logger.error(
          `You do not have the rights to delete environment ${this.chalk.bold(
            config.environmentId,
          )}.`,
        );
        this.exit(1);
      } else {
        throw err;
      }
    }
  }

  async catch(error) {
    await this.handleAuthenticationErrors(error);
    return super.catch(error);
  }
}

DeleteCommand.description = 'Delete an environment.';

DeleteCommand.flags = {
  force: flags.boolean({
    char: 'force',
    description: 'Force delete.',
  }),
};

DeleteCommand.args = [
  {
    name: 'environmentId',
    required: true,
    description: 'ID of an environment.',
  },
];

module.exports = DeleteCommand;
