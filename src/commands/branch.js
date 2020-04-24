const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

class BranchCommand extends AbstractAuthenticatedCommand {
  async listBranches() {
    try {
      const branches = await BranchManager.getBranches();
      if (!branches || branches.length === 0) {
        return this.error("⚠️ You don't have any branch yet. Use `forest branch <branch_name>` to create one.");
      }
      // FIXME: Handle branch selection
      //        Cases: #9
    } catch (err) {
      // FIXME: Display switch branch error
    }
    return null;
  }

  async createBranch(branchName) {
    try {
      await BranchManager.createBranch(branchName);
      // FIXME: Handle branch creation
      //        Cases: #1, #2, #4
      return this.log(`✅ Switched to new branch: ${branchName}.`);
    } catch (err) {
      const customError = BranchManager.handleError(err);
      // FIXME: Display correct error, depending on the case
      //        - Branch already exist
      //        - Server branch creation failed
      //        - Absence of a remote or a production environment
      //        Cases: #5, #6, #7
      // return this.error(`❌ Failed create ${branchName}.`);
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
    const commandOptions = { ...parsed.flags, ...parsed.args };
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
      return this.createBranch(config.BRANCH_NAME);
    }
    return this.listBranches();
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
