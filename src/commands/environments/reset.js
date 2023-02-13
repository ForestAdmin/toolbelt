const { flags } = require('@oclif/command');
const EnvironmentManager = require('../../services/environment-manager');
const ProjectManager = require('../../services/project-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command').default;
const withCurrentProject = require('../../services/with-current-project');
const { handleError } = require('../../utils/error');
const askForEnvironment = require('../../services/ask-for-environment');

class ResetCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async run() {
    await this.checkAuthentication();

    const parsed = this.parse(ResetCommand);
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

      if (!config.environment) {
        config.environment = await askForEnvironment(
          config,
          'Select the remote environment you want to reset',
          ['remote'],
        );
      }

      if (!config.force) {
        const response = await this.inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Reset changes on the environment ${config.environment}`,
          },
        ]);
        if (!response.confirm) return;
      }

      await new EnvironmentManager(config).reset(config.environment, config.envSecret);
      this.logger.success(
        `Environment ${config.environment} successfully reset. Please refresh your browser to see the new state.`,
      );
    } catch (error) {
      if (error.response && error.status === 403) {
        this.logger.error(
          `You do not have the rights to reset the layout of the environment ${config.environment}`,
        );
      } else {
        this.logger.error(handleError(error));
      }
      this.exit(2);
    }
  }

  async catch(error) {
    await this.handleAuthenticationErrors(error);
    return super.catch(error);
  }
}

ResetCommand.description = 'Reset a remote environment by removing all layout changes';

ResetCommand.flags = {
  environment: flags.string({
    char: 'e',
    description: 'The remote environment name to reset.',
  }),
  force: flags.boolean({
    description: 'Skip reset changes confirmation.',
  }),
  projectId: flags.integer({
    char: 'p',
    description: 'The id of the project to work on.',
    default: null,
  }),
};

module.exports = ResetCommand;
