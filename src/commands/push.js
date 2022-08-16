const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const withCurrentProject = require('../services/with-current-project');

class PushCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(PushCommand);
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
      const branches = await BranchManager.getBranches(config.envSecret);

      const currentBranch = branches.find((branch) => branch.isCurrent);

      if (!currentBranch) {
        throw new Error('No current branch.');
      }

      if (!config.force) {
        const response = await this.inquirer
          .prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Push branch ${currentBranch.name} onto ${currentBranch.originEnvironment.name}`,
          }]);
        if (!response.confirm) return;
      }

      await BranchManager.pushBranch(config.envSecret);
      this.logger.success(`Branch ${currentBranch.name} successfully pushed onto ${currentBranch.originEnvironment.name}.`);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);
      this.logger.error(customError);
      this.exit(2);
    }
  }
}

PushCommand.aliases = ['branches:push'];

PushCommand.description = 'Push layout changes of your current branch to the branch origin.';

PushCommand.flags = {
  force: AbstractAuthenticatedCommand.flags.boolean({
    description: 'Skip push changes confirmation.',
  }),
  help: AbstractAuthenticatedCommand.flags.boolean({
    description: 'Display usage information.',
  }),
  projectId: AbstractAuthenticatedCommand.flags.integer({
    char: 'p',
    description: 'The id of the project to work on.',
    default: null,
  }),
};

module.exports = PushCommand;
