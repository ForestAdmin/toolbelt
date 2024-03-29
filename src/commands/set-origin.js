const { Flags, Args } = require('@oclif/core');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command').default;
const BranchManager = require('../services/branch-manager');
const ProjectManager = require('../services/project-manager');
const askForEnvironment = require('../services/ask-for-environment');
const withCurrentProject = require('../services/with-current-project');

class SetOriginCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async runAuthenticated() {
    const parsed = await this.parse(SetOriginCommand);
    const envSecret = this.env.FOREST_ENV_SECRET;
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };
    let config;

    try {
      config = await withCurrentProject({ ...this.env, ...commandOptions });

      if (!config.envSecret) {
        const environment = await new ProjectManager(config).getDevelopmentEnvironmentForUser(
          config.projectId,
        );
        config.envSecret = environment.secretKey;
      }

      if (!config.ENVIRONMENT_NAME) {
        config.ENVIRONMENT_NAME = await askForEnvironment(
          config,
          'Select the environment you want to set as origin',
          ['remote', 'production'],
        );
      }

      await BranchManager.setOrigin(config.ENVIRONMENT_NAME, config.envSecret);
      this.logger.success(`Origin "${config.ENVIRONMENT_NAME}" successfully set.`);
    } catch (error) {
      const customError = await BranchManager.handleBranchError(error);
      this.logger.error(customError);
      this.exit(2);
    }
  }
}

SetOriginCommand.aliases = ['branches:origin'];

SetOriginCommand.description =
  "Set an environment as your branch's origin. Your branch will build on top of that environment's layout.";

SetOriginCommand.flags = {
  help: Flags.boolean({
    description: 'Display usage information.',
  }),
};

SetOriginCommand.args = {
  ENVIRONMENT_NAME: Args.string({
    name: 'ENVIRONMENT_NAME',
    required: false,
    description: 'The environment to set as origin.',
  }),
};

module.exports = SetOriginCommand;
