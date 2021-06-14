const fs = require('fs');
const { flags } = require('@oclif/command');
const makeDefaultPlan = require('../context/plan');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const { buildDatabaseUrl } = require('../utils/database-url');
const withCurrentProject = require('../services/with-current-project');
const ProjectManager = require('../services/project-manager');
const EnvironmentManager = require('../services/environment-manager');
const {
  handleInitError,
  handleDatabaseConfiguration,
  validateEndpoint,
  getApplicationPortFromCompleteEndpoint,
  amendDotenvFile,
  createDotenvFile,
  displayEnvironmentVariablesAndCopyToClipboard,
} = require('../services/init-manager');

const SUCCESS_MESSAGE_ALL_SET_AND_READY = "You're now set up and ready to develop on Forest Admin";
const SUCCESS_MESSAGE_LEARN_MORE_ON_CLI_USAGE = 'To learn more about the recommended usage of this CLI, please visit https://docs.forestadmin.com/documentation/reference-guide/how-it-works/developing-on-forest-admin/forest-cli-commands.';

const PROMPT_MESSAGE_AUTO_FILLING_ENV_FILE = 'Do you want your current folder `.env` file to be completed automatically with your environment variables?';
const PROMPT_MESSAGE_AUTO_CREATING_ENV_FILE = 'Do you want a new `.env` file (containing your environment variables) to be automatically created in your current folder?';

class InitCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const {
      assertPresent,
      inquirer,
      env,
      spinner,
    } = this.context;
    assertPresent({ inquirer, env, spinner });

    this.environmentVariables = {};
    this.inquirer = inquirer;
    this.env = env;
    this.spinner = spinner;
  }

  async runIfAuthenticated() {
    try {
      this.spinner.start({ text: 'Selecting your project' });
      await this.spinner.attachToPromise(this.projectSelection());

      this.spinner.start({ text: 'Analyzing your setup' });
      await this.spinner.attachToPromise(this.projectValidation());

      this.spinner.start({ text: 'Checking your database setup' });
      await this.spinner.attachToPromise(this.handleDatabaseUrlConfiguration());

      this.spinner.start({ text: 'Setting up your development environment' });
      await this.spinner.attachToPromise(this.developmentEnvironmentCreation());

      await this.environmentVariablesAutoFilling();

      this.spinner.start({ text: SUCCESS_MESSAGE_ALL_SET_AND_READY });
      this.spinner.success();
      this.logger.info(SUCCESS_MESSAGE_LEARN_MORE_ON_CLI_USAGE);
    } catch (error) {
      const exitMessage = handleInitError(error);
      this.logger.error(exitMessage);
      this.exit(1);
    }
  }

  async projectSelection() {
    const parsed = this.parse(InitCommand);
    this.config = await withCurrentProject({
      ...this.env,
      ...parsed.flags,
      includeLegacy: true,
    });
  }

  async projectValidation() {
    const project = await new ProjectManager(this.config).getProjectForDevWorkflow();
    this.environmentVariables.projectOrigin = project.origin;
  }

  async handleDatabaseUrlConfiguration() {
    if (this.environmentVariables.projectOrigin !== 'In-app') {
      const isDatabaseAlreadyConfigured = !!this.env.DATABASE_URL;

      if (!isDatabaseAlreadyConfigured) {
        this.spinner.pause();
        const databaseConfiguration = await handleDatabaseConfiguration();
        this.spinner.continue();
        if (databaseConfiguration) {
          this.environmentVariables.databaseUrl = buildDatabaseUrl(databaseConfiguration);
          this.environmentVariables.databaseSchema = databaseConfiguration.dbSchema;
          this.environmentVariables.databaseSSL = databaseConfiguration.ssl;
        }
      }
    }
  }

  async developmentEnvironmentCreation() {
    let developmentEnvironment;
    try {
      developmentEnvironment = await new ProjectManager(this.config)
        .getDevelopmentEnvironmentForUser(this.config.projectId);
    } catch (error) {
      developmentEnvironment = null;
    }

    if (!developmentEnvironment) {
      this.spinner.pause();
      const prompter = await this.inquirer.prompt([{
        name: 'endpoint',
        message: 'Enter your local admin backend endpoint:',
        type: 'input',
        default: 'http://localhost:3310',
        validate: validateEndpoint,
      }]);
      this.spinner.continue();

      developmentEnvironment = await new EnvironmentManager(this.config)
        .createDevelopmentEnvironment(this.config.projectId, prompter.endpoint);
    }
    this.environmentVariables.forestEnvSecret = developmentEnvironment.secretKey;
    this.environmentVariables.applicationPort = getApplicationPortFromCompleteEndpoint(
      developmentEnvironment.apiEndpoint,
    );
  }

  async environmentVariablesAutoFilling() {
    if (this.environmentVariables.projectOrigin !== 'In-app') {
      const existingEnvFile = fs.existsSync('.env');
      const response = await this.inquirer
        .prompt([{
          type: 'confirm',
          name: 'autoFillOrCreationConfirmation',
          message: existingEnvFile
            ? PROMPT_MESSAGE_AUTO_FILLING_ENV_FILE
            : PROMPT_MESSAGE_AUTO_CREATING_ENV_FILE,
        }]);
      if (response.autoFillOrCreationConfirmation) {
        try {
          return existingEnvFile
            ? amendDotenvFile(this.environmentVariables)
            : createDotenvFile(this.environmentVariables);
        } catch (error) {
          return displayEnvironmentVariablesAndCopyToClipboard(this.environmentVariables);
        }
      }
    }
    return displayEnvironmentVariablesAndCopyToClipboard(this.environmentVariables);
  }
}

InitCommand.description = 'Set up your development environment in your current folder.';

InitCommand.flags = {
  projectId: flags.integer({
    char: 'p',
    description: 'The id of the project you want to init.',
  }),
};

module.exports = InitCommand;
