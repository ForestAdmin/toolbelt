const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const withCurrentProject = require('../services/with-current-project');

class SwitchCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async selectBranch(branches) {
    try {
      const { branch } = await this.inquirer.prompt([
        {
          name: 'branch',
          message: 'Select the branch you want to set current',
          type: 'list',
          choices: [
            // NOTICE: Current branch should be last displayed branch.
            ...branches.filter(currentBranch => !currentBranch.isCurrent),
            ...branches.filter(currentBranch => currentBranch.isCurrent),
          ].map(currentBranch => currentBranch.name),
        },
      ]);

      return branch;
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);

      this.logger.error(customError);
      return null;
    }
  }

  async switchTo(selectedBranch, environmentSecret) {
    try {
      await BranchManager.switchBranch(selectedBranch, environmentSecret);

      this.logger.success(`Switched to branch: ${selectedBranch.name}.`);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);

      this.logger.error(customError);
      this.exit(2);
    }
  }

  async getConfig() {
    const envSecret = this.env.FOREST_ENV_SECRET;
    const parsed = this.parse(SwitchCommand);
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };

    const config = await withCurrentProject({ ...this.env, ...commandOptions });

    if (!config.envSecret) {
      const environment = await new ProjectManager(config).getDevelopmentEnvironmentForUser(
        config.projectId,
      );
      config.envSecret = environment.secretKey;
    }

    return config;
  }

  async runIfAuthenticated() {
    try {
      const config = await this.getConfig();
      const branches = (await BranchManager.getBranches(config.envSecret)) || [];

      if (branches.length === 0) {
        this.logger.warn(
          "You don't have any branch to set as current. Use `forest branch <branch_name>` to create one.",
        );
        return;
      }

      const selectedBranchName = config.BRANCH_NAME || (await this.selectBranch(branches));
      if (!selectedBranchName) {
        this.exit(2);
      }

      const selectedBranch = branches.find(branch => branch.name === selectedBranchName);
      const currentBranch = branches.find(branch => branch.isCurrent);

      if (selectedBranch === undefined) {
        throw new Error('Branch does not exist.');
      }

      if (currentBranch && currentBranch.name === selectedBranchName) {
        this.logger.info(`${selectedBranchName} is already your current branch.`);
      } else {
        await this.switchTo(selectedBranch, config.envSecret);
      }
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);
      this.logger.error(customError);
      this.exit(2);
    }
  }
}

SwitchCommand.aliases = ['branches:switch'];

SwitchCommand.description = 'Switch to another branch in your local development environment.';

SwitchCommand.flags = {
  help: flags.boolean({
    description: 'Display usage information.',
  }),
};

SwitchCommand.args = [
  {
    name: 'BRANCH_NAME',
    required: false,
    description: 'The name of the local branch to set as current.',
  },
];

SwitchCommand.aliases = ['branch:switch'];

module.exports = SwitchCommand;
