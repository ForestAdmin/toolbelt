const { flags } = require('@oclif/command');
const inquirer = require('inquirer');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const EnvironmentManager = require('../services/environment-manager');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

class PushCommand extends AbstractAuthenticatedCommand {
  static async askForEnvironment(config) {
    const environemnts = await new EnvironmentManager(config).listEnvironments();
    const remoteEnvironments = environemnts.filter((environemnt) => environemnt.type === 'remote');

    if (remoteEnvironments.length) {
      const response = await inquirer.prompt([{
        name: 'environment',
        message: 'Select the remote environment you want to push onto',
        type: 'list',
        choices: remoteEnvironments.map(
          (environemnt) => ({ name: environemnt.name, value: environemnt.name }),
        ),
      }]);
      return response.environment;
    }
    throw new Error('No production/remote environment.');
  }

  async runIfAuthenticated() {
    const parsed = this.parse(PushCommand);
    const commandOptions = { ...parsed.flags, ...parsed.args };
    let config;

    try {
      config = await withCurrentProject({ ...envConfig, ...commandOptions });

      const developmentEnvironment = await new ProjectManager(config)
        .getDevelopmentEnvironmentForUser(config.projectId);
      config.envSecret = developmentEnvironment.secretKey;

      const developmentBranches = await BranchManager.getBranches(config.envSecret);
      const currentBranch = developmentBranches.find((branch) => branch.isCurrent);

      if (!currentBranch) {
        throw new Error('No current branch.');
      }

      if (!config.environment) {
        config.environment = await PushCommand.askForEnvironment(config);
      }

      if (!config.force) {
        const response = await inquirer
          .prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Push branch ${currentBranch.name} onto ${config.environment}`,
          }]);
        if (!response.confirm) return null;
      }

      await BranchManager.pushBranch(config.environment, config.envSecret);
      return this.log(`✅ Branch ${currentBranch.name} successfully pushed onto ${config.environment}.`);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);
      return this.error(customError);
    }
  }
}

PushCommand.description = 'Push layout changes of your current branch to a remote environment';

PushCommand.flags = {
  environment: flags.string({
    char: 'e',
    description: 'The remote environment name to push onto',
  }),
  projectId: flags.string({
    description: 'The id of the project to work on',
  }),
  force: flags.boolean({
    description: 'Skip push changes confirmation',
  }),
  help: flags.boolean({
    description: 'Display usage information',
  }),
};

module.exports = PushCommand;
