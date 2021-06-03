const { flags } = require('@oclif/command');
const defaultPlan = require('../context/init');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const EnvironmentManager = require('../services/environment-manager');
const withCurrentProject = require('../services/with-current-project');

class PushCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  // TODO: DWO EP17 probably update this function to handle environment selection
  async askForEnvironment(config) {
    const environments = await new EnvironmentManager(config).listEnvironments();
    const remoteEnvironments = environments.filter((environment) => environment.type === 'remote');

    if (remoteEnvironments.length) {
      const response = await this.inquirer.prompt([{
        name: 'environment',
        message: 'Select the remote environment you want to push onto',
        type: 'list',
        choices: remoteEnvironments.map(({ name }) => name),
      }]);
      return response.environment;
    }
    throw new Error('No remote environment.');
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
        config.environment = await this.askForEnvironment(config);
      }

      if (!config.force) {
        const response = await this.inquirer
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

PushCommand.description = 'Push layout changes of your current branch to a remote environment.';

PushCommand.flags = {
  // TODO: DWO EP17 remove environment option
  environment: flags.string({
    char: 'e',
    description: 'The remote environment name to push onto.',
  }),
  force: flags.boolean({
    description: 'Skip push changes confirmation.',
  }),
  help: flags.boolean({
    description: 'Display usage information.',
  }),
  projectId: flags.string({
    char: 'p',
    description: 'The id of the project to work on.',
    default: null,
  }),
};

module.exports = PushCommand;
