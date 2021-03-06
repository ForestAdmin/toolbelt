const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const EnvironmentManager = require('../services/environment-manager');
const ProjectManager = require('../services/project-manager');
const { handleBranchError } = require('../services/branch-manager');
const withCurrentProject = require('../services/with-current-project');

/** Deploy layout changes of an environment to the reference one. */
class DeployCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  /**
   * Get selected environment; prompt for environment when none is provided.
   * @param {Object} config - Actual command config (including command parameters).
   * @throws Will throw an error when there is no environment (unreachable).
   * @throws Will throw an error when there is no reference environment.
   * @return {Object} The environment found.
   */
  async getEnvironment(config) {
    const environments = await new EnvironmentManager(config).listEnvironments();

    if (environments.length === 0) throw new Error('No environment found.');

    const environmentName = config.ENVIRONMENT_NAME || await this.selectEnvironment(environments);
    return environments.find((environment) => environment.name === environmentName);
  }

  /**
   * Display an environment selector.
   * @param {Array} environments List of environments (from backend).
   * @see getEnvironment
   */
  async selectEnvironment(environments) {
    // NOTICE: Remove production since it should not be deployable on itself.
    const choices = environments
      .filter((environment) => environment.type !== 'production')
      .map(({ name }) => name);
    const response = await this.inquirer.prompt([{
      name: 'environment',
      message: 'Select the environment containing the layout changes you want to deploy to the reference environment',
      type: 'list',
      choices,
    }]);
    return response.environment;
  }

  /**
   * Get command configuration (merge env configuration with command context).
   * @returns {Object} The command configuration, including its envSecret correctly set.
   */
  async getConfig() {
    const envSecret = this.env.FOREST_ENV_SECRET;
    const parsed = this.parse(DeployCommand);
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };
    const config = await withCurrentProject({ ...this.env, ...commandOptions });

    if (!config.envSecret) {
      const environment = await new ProjectManager(config)
        .getDevelopmentEnvironmentForUser(config.projectId);
      config.envSecret = environment.secretKey;
    }

    return config;
  }

  /**
   * Ask for confirmation before deploying layout changes.
   * @param {Object} environment - The environment containing the layout changes to deploy.
   * @returns {Boolean} Return true if user has confirmed.
   */
  async confirm(environment) {
    const response = await this.inquirer
      .prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Deploy ${environment.name} layout changes to reference?`,
      }]);
    return response.confirm;
  }

  /**
   * The "deploy" command procedure itself.
   * @returns {void}
   */
  async runIfAuthenticated() {
    try {
      const config = await this.getConfig();
      const environment = await this.getEnvironment(config);

      if (environment === undefined) throw new Error('Environment not found.');

      if (!config.force && !(await this.confirm(environment))) return;

      await new EnvironmentManager(config).deploy(environment);

      this.logger.success(`Deployed ${environment.name} layout changes to reference environment.`);
    } catch (error) {
      this.logger.error(handleBranchError(error));
      this.exit(2);
    }
  }
}

DeployCommand.aliases = ['environments:deploy'];

DeployCommand.description = 'Deploy layout changes of an environment to the reference one.';

DeployCommand.flags = {
  help: AbstractAuthenticatedCommand.flags.boolean({
    description: 'Display usage information.',
  }),
  force: AbstractAuthenticatedCommand.flags.boolean({
    char: 'f',
    description: 'Skip deploy confirmation.',
  }),
  projectId: AbstractAuthenticatedCommand.flags.integer({
    char: 'p',
    description: 'The id of the project you want to deploy.',
    default: null,
  }),
};

DeployCommand.args = [{
  name: 'ENVIRONMENT_NAME', required: false, description: 'The name of the environment containing the layout changes to deploy to the reference one.',
}];

module.exports = DeployCommand;
