const { flags } = require('@oclif/command');
const inquirer = require('inquirer');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

class SwitchCommand extends AbstractAuthenticatedCommand {
  async selectBranch(branches) {
    try {
      const { branch } = await inquirer.prompt([{
        name: 'branch',
        message: 'Select the branch you want to set current',
        type: 'list',
        choices: [
          // NOTICE: Current branch should be last dispalyed branch.
          ...branches.filter((currentBranch) => !currentBranch.isCurrent),
          ...branches.filter((currentBranch) => currentBranch.isCurrent),
        ].map((currentBranch) => currentBranch.name),
      }]);

      return branch;
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);

      return this.error(customError);
    }
  }

  async switchTo(selectedBranch, environmentSecret) {
    try {
      await BranchManager.switchBranch(selectedBranch, environmentSecret);

      return this.log(`✅ Switched to branch: ${selectedBranch.name}.`);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);

      return this.error(customError);
    }
  }

  async getConfig() {
    const envSecret = process.env.FOREST_ENV_SECRET;
    const parsed = this.parse(SwitchCommand);
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };

    const config = await withCurrentProject({ ...envConfig, ...commandOptions });

    if (!config.envSecret) {
      const environment = await new ProjectManager(config)
        .getDevelopmentEnvironmentForUser(config.projectId);
      config.envSecret = environment.secretKey;
    }

    return config;
  }

  async runIfAuthenticated() {
    try {
      const config = await this.getConfig();
      const branches = await BranchManager.getBranches(config.envSecret) || [];

      if (branches.length === 0) {
        return this.log("⚠️  You don't have any branch to set as current. Use `forest branch <branch_name>` to create one.");
      }

      const selectedBranchName = config.BRANCH_NAME || await this.selectBranch(branches);
      const selectedBranch = branches.find((branch) => branch.name === selectedBranchName);
      const currentBranch = branches.find((branch) => branch.isCurrent);

      if (selectedBranch === undefined) {
        throw new Error('Branch does not exist.');
      }
      if (currentBranch.name === selectedBranchName) {
        return this.log(`ℹ️  ${selectedBranchName} is already your current branch.`);
      }

      return this.switchTo(selectedBranch, config.envSecret);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);
      return this.error(customError);
    }
  }
}

SwitchCommand.description = 'Switch to another branch in your local development environment';

SwitchCommand.flags = {
  help: flags.boolean({
    description: 'Display usage information',
  }),
};

SwitchCommand.args = [{
  name: 'BRANCH_NAME', required: false, description: 'The name of the local branch to set as current',
}];

module.exports = SwitchCommand;
