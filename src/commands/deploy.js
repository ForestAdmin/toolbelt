const { flags } = require('@oclif/command');
const inquirer = require('inquirer');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const EnvironmentManager = require('../services/environment-manager');
const ProjectManager = require('../services/project-manager');
const { handleBranchError } = require('../services/branch-manager');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

/** Deploy layout changes of an environment to production. */
class DeployCommand extends AbstractAuthenticatedCommand {
  /**
   * Get selected environment; prompt for environment when none is provided.
   * @param {Object} config - Actual command config (including command parameters).
   * @throws Will throw an error when there is no environment (unreachable).
   * @throws Will throw an error when there is no production environment.
   * @return {Object} The environment found.
   */
  static async getEnvironment(config) {
    const environments = await new EnvironmentManager(config).listEnvironments();
    const productionExists = environments.find((environment) => environment.type === 'production');

    if (environments.length === 0) throw new Error('❌ No environment found.');
    if (!productionExists) throw new Error('❌ You need a production environment to run this command.');

    const environmentName = config.ENVIRONMENT_NAME
      || await DeployCommand.selectEnvironment(environments);
    return environments.find((environment) => environment.name === environmentName);
  }

  /**
   * Display an environment selector.
   * @param {Array} environments List of environments (from backend).
   * @see getEnvironment
   */
  static async selectEnvironment(environments) {
    const response = await inquirer.prompt([{
      name: 'environment',
      message: 'Select the environment containing the layout changes you want to deploy to production',
      type: 'list',
      choices: environments
        // NOTICE: Remove production since it should not be deployable on itself.
        .filter((environment) => environment.type !== 'production')
        .map(({ name }) => name),
    }]);
    return response.environment;
  }

  /**
   * Get command configuration (merge env configuration with command context).
   * @returns {Object} The command configuration, including its envSecret correctly set.
   */
  async getConfig() {
    const envSecret = process.env.FOREST_ENV_SECRET;
    const parsed = this.parse(DeployCommand);
    const commandOptions = { ...parsed.flags, ...parsed.args, envSecret };
    const config = await withCurrentProject({ ...envConfig, ...commandOptions });

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
  static async confirm(environment) {
    const response = await inquirer
      .prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Deploy ${environment.name} layout changes to production?`,
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
      const environment = await DeployCommand.getEnvironment(config);

      if (environment === undefined) throw new Error('Environment not found.');
      if (environment.type === 'production') throw new Error('❌ You cannot deploy production onto itself.');
      if (!config.force && !(await DeployCommand.confirm(environment))) return null;

      await new EnvironmentManager(config).deploy(environment);

      return this.log(`✅ Deployed ${environment.name} layout changes to production.`);
    } catch (error) {
      return this.error(handleBranchError(error));
    }
  }
}

DeployCommand.description = 'Deploy layout changes of an environment to production.';

DeployCommand.flags = {
  help: flags.boolean({
    description: 'Display usage information.',
  }),
  force: flags.boolean({
    char: 'f',
    description: 'Skip deploy confirmation.',
  }),
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID.',
    default: null,
  }),
};

DeployCommand.args = [{
  name: 'ENVIRONMENT_NAME', required: false, description: 'The name of the environment containing the layout changes to deploy to production.',
}];

module.exports = DeployCommand;
