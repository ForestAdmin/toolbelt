const { flags } = require('@oclif/command');
const inquirer = require('inquirer');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

class SwitchCommand extends AbstractAuthenticatedCommand {
  async selectBranch(envSecret) {
    try {
      const branches = await BranchManager.getBranches(envSecret);
      if (!branches || branches.length === 0) {
        return this.log("⚠️ You don't have any branch to set as current. Use `forest branch <branch_name>` to create one.");
      }
      const response = await inquirer.prompt([{
        name: 'branch',
        message: 'Select the branch you want to set current',
        type: 'list',
        choices: branches.map((branch) => ({ name: branch.name, value: branch.id })),
      }]);

      return response;
    } catch (error) {
      const customError = BranchManager.handleError(error);

      return this.error(customError);
    }
    return null;
  }

  async switchTo(branchName, environmentSecret) {
    try {
      await BranchManager.switchBranch(branchName, environmentSecret);

      return this.log(`✅ Switched to branch: ${branchName}.`);
    } catch (error) {
      const customError = BranchManager.handleError(error);

      return this.error(customError);
    }
  }

  async runIfAuthenticated() {
    const parsed = this.parse(SwitchCommand);
    const envSecret = process.env.FOREST_ENV_SECRET;
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };
    let config;

    try {
      config = await withCurrentProject({ ...envConfig, ...commandOptions });

      if (!config.envSecret) {
        const environment = await new ProjectManager(config)
          .getDevelopmentEnvironmentForUser(config.projectId);
        config.envSecret = environment.secretKey;
      }
    } catch (error) {
      const customError = BranchManager.handleError(error);
      return this.error(customError);
    }

    const branchName = config.BRANCH_NAME || await this.selectBranch(config.envSecret);
    return this.switchTo(branchName, config.envSecret);
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
