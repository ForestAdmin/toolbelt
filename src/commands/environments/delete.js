const { flags } = require('@oclif/command');
const chalk = require('chalk');
const inquirer = require('inquirer');
const defaultPlan = require('../../context/init');
const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class DeleteCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(DeleteCommand);
    const config = { ...this.env, ...parsed.flags, ...parsed.args };
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
        try {
          await manager.deleteEnvironment(config.environmentId);
          return this.log(`Environment ${chalk.red(environment.name)} successfully deleted.`);
        } catch (error) {
          this.logger.error('Oops, something went wrong.');
          return this.exit(1);
        }
      }
      this.logger.error(`Confirmation did not match ${chalk.red(environment.name)}. Aborted.`);
      return this.exit(1);
    } catch (err) {
      if (err.status === 404) {
        this.logger.error(`Cannot find the environment ${chalk.bold(config.environmentId)}.`);
        return this.exit(1);
      }
      if (err.status === 403) {
        this.logger.error(`You do not have the rights to delete environment ${chalk.bold(config.environmentId)}.`);
        return this.exit(1);
      }
      throw err;
    }
  }
}

DeleteCommand.description = 'Delete an environment.';

DeleteCommand.flags = {
  force: flags.boolean({
    char: 'force',
    description: 'Force delete.',
  }),
};

DeleteCommand.args = [{
  name: 'environmentId', required: true, description: 'ID of an environment.',
}];

module.exports = DeleteCommand;
