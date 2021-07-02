const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const withCurrentProject = require('../services/with-current-project');

class BranchCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async listBranches(envSecret) {
    try {
      const branches = await BranchManager.getBranches(envSecret);
      if (!branches || branches.length === 0) {
        this.logger.warn('You don\'t have any branch yet. Use `forest branch <branch_name>` to create one.');
      } else {
        branches.forEach((branch) => {
          this.logger.log(`${branch.name} ${branch.isCurrent ? '< current branch' : ''}`);
        });
      }
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);

      this.logger.error(customError);
      this.exit(2);
    }
  }

  async createBranch(branchName, environmentSecret) {
    try {
      await BranchManager.createBranch(branchName, environmentSecret);

      this.logger.success(`Switched to new branch: ${branchName}.`);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);

      this.logger.error(customError);
      this.exit(2);
    }
  }

  async deleteBranch(branchName, forceDelete, envSecret) {
    if (!forceDelete) {
      const response = await this.inquirer
        .prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Delete branch ${branchName}`,
        }]);
      if (!response.confirm) return;
    }
    try {
      await BranchManager.deleteBranch(branchName, envSecret);
      this.logger.success(`Branch ${branchName} successfully deleted.`);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);

      this.logger.error(customError);
      this.exit(2);
    }
  }

  async runIfAuthenticated() {
    const parsed = this.parse(BranchCommand);
    const envSecret = this.env.FOREST_ENV_SECRET;
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };
    let config;

    try {
      config = await withCurrentProject({ ...this.env, ...commandOptions });

      if (!config.envSecret) {
        const environment = await new ProjectManager(config)
          .getDevelopmentEnvironmentForUser(config.projectId);
        config.envSecret = environment.secretKey;
      }
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);
      this.logger.error(customError);
      this.exit(2);
      return null;
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

BranchCommand.aliases = ['branches'];

BranchCommand.description = 'Create a new branch or list your existing branches.';

BranchCommand.flags = {
  projectId: AbstractAuthenticatedCommand.flags.integer({
    description: 'The id of the project to create a branch in.',
  }),
  delete: AbstractAuthenticatedCommand.flags.boolean({
    char: 'd',
    description: 'Delete the branch.',
  }),
  force: AbstractAuthenticatedCommand.flags.boolean({
    description: 'When deleting a branch, skip confirmation.',
  }),
  help: AbstractAuthenticatedCommand.flags.boolean({
    description: 'Display usage information.',
  }),
};

BranchCommand.args = [{
  name: 'BRANCH_NAME', required: false, description: 'The name of the branch to create.',
}];

module.exports = BranchCommand;
