const { flags } = require('@oclif/command');
const inquirer = require('inquirer');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

class BranchCommand extends AbstractAuthenticatedCommand {
  async listBranches(envSecret) {
    try {
      const branches = await BranchManager.getBranches(envSecret);
      if (!branches || branches.length === 0) {
        return this.log("⚠️ You don't have any branch yet. Use `forest branch <branch_name>` to create one.");
      }
      branches.forEach((branch) => {
        this.log(`${branch.name} ${branch.isCurrent ? '< current branch' : ''}`);
      });
    } catch (error) {
      const customError = BranchManager.handleError(error);

      return this.error(customError);
    }
    return null;
  }

  async createBranch(branchName, environmentSecret) {
    try {
      await BranchManager.createBranch(branchName, environmentSecret);

      return this.log(`✅ Switched to new branch: ${branchName}.`);
    } catch (error) {
      const customError = BranchManager.handleError(error);

      return this.error(customError);
    }
  }

  async deleteBranch(branchName, forceDelete, envSecret) {
    if (!forceDelete) {
      const response = await inquirer
        .prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Delete branch ${branchName}`,
        }]);
      if (!response.confirm) return null;
    }
    try {
      await BranchManager.deleteBranch(branchName, envSecret);
      return this.log(`✅ Branch ${branchName} successfully deleted.`);
    } catch (error) {
      const customError = BranchManager.handleError(error);

      return this.error(customError);
    }
  }

  async runIfAuthenticated() {
    const parsed = this.parse(BranchCommand);
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

    if (config.BRANCH_NAME) {
      if (config.delete) {
        return this.deleteBranch(config.BRANCH_NAME, config.force, config.envSecret);
      }
      return this.createBranch(config.BRANCH_NAME, config.envSecret);
    }
    return this.listBranches(config.envSecret);
  }
}

BranchCommand.description = 'Create a new branch or list your existing branches';

BranchCommand.flags = {
  projectId: flags.string({
    description: 'The id of the project to create a branch in',
  }),
  delete: flags.boolean({
    char: 'd',
    description: 'Delete the branch',
  }),
  force: flags.boolean({
    description: 'When deleting a branch, skip confirmation',
  }),
  help: flags.boolean({
    description: 'Display usage information',
  }),
};

BranchCommand.args = [{
  name: 'BRANCH_NAME', required: false, description: 'The name of the branch to create',
}];

module.exports = BranchCommand;
