const EnvironmentManager = require('../../services/environment-manager');
const ProjectManager = require('../../services/project-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const withCurrentProject = require('../../services/with-current-project');
const { handleError } = require('../../utils/error');

class ResetCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  async askForEnvironment(config) {
    const environments = await new EnvironmentManager(config).listEnvironments();
    const remoteEnvironments = environments.filter((environment) => environment.type === 'remote');

    if (remoteEnvironments.length) {
      const response = await this.inquirer.prompt([{
        name: 'environment',
        message: 'Select the remote environment you want to reset',
        type: 'list',
        choices: remoteEnvironments.map(({ name }) => name),
      }]);
      return response.environment;
    }
    throw new Error('No remote environment.');
  }

  async runIfAuthenticated() {
    const parsed = this.parse(ResetCommand);
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

      if (!config.environment) {
        config.environment = await this.askForEnvironment(config);
      }

      if (!config.force) {
        const response = await this.inquirer
          .prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Reset changes on the environment ${config.environment}`,
          }]);
        if (!response.confirm) return;
      }

      await new EnvironmentManager(config).reset(config.environment, config.envSecret);
      this.logger.success(`Environment ${config.environment} successfully reset. Please refresh your browser to see the new state.`);
    } catch (error) {
      if (error.response && error.status === 403) {
        this.logger.error(`You do not have the rights to reset the layout of the environment ${config.environment}`);
      } else {
        this.logger.error(handleError(error));
      }
      this.exit(2);
    }
  }
}

ResetCommand.description = 'Reset a remote environment by removing all layout changes';

ResetCommand.flags = {
  environment: AbstractAuthenticatedCommand.flags.string({
    char: 'e',
    description: 'The remote environment name to reset.',
  }),
  force: AbstractAuthenticatedCommand.flags.boolean({
    description: 'Skip reset changes confirmation.',
  }),
  projectId: AbstractAuthenticatedCommand.flags.integer({
    char: 'p',
    description: 'The id of the project to work on.',
    default: null,
  }),
};

module.exports = ResetCommand;
