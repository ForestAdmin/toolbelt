const { flags } = require('@oclif/command');
const chalk = require('chalk');
const inquirer = require('inquirer');
const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const envConfig = require('../../config');

class DeleteCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const logError = this.error.bind(this);
    const parsed = this.parse(DeleteCommand);
    const config = { ...envConfig, ...parsed.flags, ...parsed.args };
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
        const deleteEnvironment = await manager.deleteEnvironment(config.environmentId, logError);
        if (deleteEnvironment) {
          return this.log(`Environment ${chalk.red(environment.name)} successfully deleted.`);
        }
        return this.error('Oops, something went wrong.', { exit: 1 });
      }
      return this.error(`Confirmation did not match ${chalk.red(environment.name)}. Aborted.`, { exit: 1 });
    } catch (err) {
      if (err.status === 404) {
        return this.error(`Cannot find the environment ${chalk.bold(config.environmentId)}.`, { exit: 1 });
      }
      if (err.status === 403) {
        return this.error(`You do not have the rights to delete environment ${chalk.bold(config.environmentId)}.`, { exit: 1 });
      }
      throw err;
    }
  }
}

DeleteCommand.description = 'delete an environment';

DeleteCommand.flags = {
  force: flags.boolean({
    char: 'force',
    description: 'Force delete',
  }),
};

DeleteCommand.args = [{
  name: 'environmentId', required: true, description: 'ID of an environment',
}];

module.exports = DeleteCommand;
