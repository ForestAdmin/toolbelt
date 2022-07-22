const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const withCurrentProject = require('../services/with-current-project');
const askForEnvironment = require('../services/ask-for-environment');

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
    const commandOptions = { ...parsed.flags, ...parsed.args };

    try {
      const config = await withCurrentProject({ ...this.env, ...commandOptions });

      const projectManager = new ProjectManager(config);
      const project = await projectManager.getProjectForDevWorkflow();

      const developmentEnvironment = await projectManager
        .getDevelopmentEnvironmentForUser(project.id);
      config.envSecret = developmentEnvironment.secretKey;

      const developmentBranches = await BranchManager.getBranches(config.envSecret);
      const currentBranch = developmentBranches.find((branch) => branch.isCurrent);

      if (!currentBranch) {
        throw new Error('No current branch.');
      }

      // TODO: DWO EP17 remove destination environemnt handle
      if (!config.environment) {
        config.environment = await askForEnvironment(config, 'Select the remote environment you want to push onto', ['remote']);
      }

      if (!config.force) {
        const response = await this.inquirer
          .prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Push branch ${currentBranch.name} onto ${config.environment}`,
          }]);
        if (!response.confirm) return;
      }

      await BranchManager.pushBranch(config.environment, config.envSecret);
      this.logger.success(`Branch ${currentBranch.name} successfully pushed onto ${config.environment}.`);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);
      this.logger.error(customError);
      this.exit(2);
    }
  }
}

PushCommand.aliases = ['branches:push'];

PushCommand.description = 'Push layout changes of your current branch to a remote environment.';

PushCommand.flags = {
  // TODO: DWO EP17 remove environment option
  environment: AbstractAuthenticatedCommand.flags.string({
    char: 'e',
    description: 'The remote environment name to push onto.',
  }),
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
