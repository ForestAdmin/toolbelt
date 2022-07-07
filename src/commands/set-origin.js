const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const EnvironmentManager = require('../services/environment-manager');
const withCurrentProject = require('../services/with-current-project');

class SetOriginCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async askForEnvironment(config) {
    const environments = await new EnvironmentManager(config).listEnvironments();
    const availableEnvironments = environments.filter((environment) => environment.type !== 'development');

    if (availableEnvironments.length) {
      const response = await this.inquirer.prompt([{
        name: 'environment',
        message: 'Select the environment you want to set as origin',
        type: 'list',
        choices: availableEnvironments.map(({ name }) => name),
      }]);
      return response.environment;
    }
    throw new Error('No remote environment.');
  }

  async runIfAuthenticated() {
    const parsed = this.parse(SetOriginCommand);
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

      if (!config.ENVIRONMENT_NAME) {
        config.ENVIRONMENT_NAME = await this.askForEnvironment(config);
      }

      await BranchManager.setOrigin(config.ENVIRONMENT_NAME, config.envSecret);
    } catch (error) {
      const customError = BranchManager.handleBranchError(error);
      this.logger.error(customError);
      this.exit(2);
    }
  }
}

SetOriginCommand.aliases = ['branches:origin'];

SetOriginCommand.description = "Set an environment as your branch's origin. Your branch will build on top of that environment's layout.";

SetOriginCommand.flags = {
  help: AbstractAuthenticatedCommand.flags.boolean({
    description: 'Display usage information.',
  }),
};

SetOriginCommand.args = [{
  name: 'ENVIRONMENT_NAME', required: false, description: 'The environment to set as origin.',
}];

module.exports = SetOriginCommand;
