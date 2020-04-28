const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

class BranchCommand extends AbstractAuthenticatedCommand {
  async listBranches(envSecret) {
    try {
      const branches = await BranchManager.getBranches(envSecret);
      if (!branches || branches.length === 0) {
        return this.warn("⚠️ You don't have any branch yet. Use `forest branch <branch_name>` to create one.");
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

  async deleteBranch(branchName, forceDelete) {
    if (!forceDelete) {
      // FIXME: Handle confirmation here
    }
    try {
      await BranchManager.deleteBranch(branchName);
      // FIXME: Handle branch deletion
      //        Cases: #10
      return this.log(`✅ Branch ${branchName} successfully deleted.`);
    } catch (err) {
      // FIXME: Display correct error, depending on the case
      //        - Branch does not exist
      //        - Server branch creation failed
      return this.error(`❌ Failed to delete ${branchName}.`);
    }
  }

  async runIfAuthenticated() {
    const parsed = this.parse(BranchCommand);
    const envSecret = process.env.FOREST_ENV_SECRET;
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };
    let config;
    if (parsed.flags.project && parsed.flags.project.length > 0) {
      // FIXME: Handle config generation using currentUser/projectName
    } else {
      try {
        config = await withCurrentProject({ ...envConfig, ...commandOptions });
      } catch (error) {
        const customError = BranchManager.handleError(error);
        return this.error(customError);
      }
    }
    // FIXME: Check for current project version
    //        Check for ENV_SECRET is present and correct
    //        AND if project has a development environment
    //        Cases: #0a, #0, #3, #8
    if (config.BRANCH_NAME) {
      if (config.delete) {
        return this.deleteBranch(config.BRANCH_NAME, config.force);
      }
      // TODO: Replace process.env.FOREST_ENV_SECRET if --project
      return this.createBranch(config.BRANCH_NAME, process.env.FOREST_ENV_SECRET);
    }
    return this.listBranches(config.envSecret);
  }
}

BranchCommand.description = 'Create a new branch or list your existing branches';

BranchCommand.flags = {
  project: flags.string({
    char: 'p',
    description: 'The name of the project to create a branch in',
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
