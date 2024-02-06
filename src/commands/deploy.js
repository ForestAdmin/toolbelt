const { Flags } = require('@oclif/core');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command').default;
const EnvironmentManager = require('../services/environment-manager');
const ProjectManager = require('../services/project-manager');
const { handleBranchError } = require('../services/branch-manager');
const withCurrentProject = require('../services/with-current-project');

/** Deploy layout changes of an environment to the reference one. */
class DeployCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env, inquirer } = this.context;
    assertPresent({ env, inquirer });
    this.env = env;
    this.inquirer = inquirer;
  }

  /**
   * Get command configuration (merge env configuration with command context).
   * @returns {Object} The command configuration, including its envSecret correctly set.
   */
  async getConfig() {
    const envSecret = this.env.FOREST_ENV_SECRET;
    const parsed = await this.parse(DeployCommand);
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

  /**
   * Ask for confirmation before deploying layout changes.
   * @param {Object} environment - The environment containing the layout changes to deploy.
   * @returns {Boolean} Return true if user has confirmed.
   */
  async confirm() {
    const response = await this.inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Deploy layout changes to reference?',
      },
    ]);
    return response.confirm;
  }

  /**
   * The "deploy" command procedure itself.
   * @returns {void}
   */
  async runAuthenticated() {
    try {
      const config = await this.getConfig();

      if (!config.force && !(await this.confirm())) return;

      await new EnvironmentManager(config).deploy();

      this.logger.success('Deployed layout changes to reference environment.');
    } catch (error) {
      this.logger.error(await handleBranchError(error));
      this.exit(2);
    }
  }
}

DeployCommand.aliases = ['environments:deploy'];

DeployCommand.description = 'Deploy layout changes of the current branch to the reference one.';

DeployCommand.flags = {
  help: Flags.boolean({
    description: 'Display usage information.',
  }),
  force: Flags.boolean({
    char: 'f',
    description: 'Skip deploy confirmation.',
  }),
  projectId: Flags.integer({
    char: 'p',
    description: 'The id of the project you want to deploy.',
    default: null,
  }),
};

module.exports = DeployCommand;
