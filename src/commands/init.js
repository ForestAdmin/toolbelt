const { flags } = require('@oclif/command');
const inquirer = require('inquirer');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const envConfig = require('../config');
const withCurrentProject = require('../services/with-current-project');
const singletonGetter = require('../services/singleton-getter');
const Spinner = require('../services/spinner');
const logger = require('../services/logger');
const ProjectManager = require('../services/project-manager');
const DatabasePrompter = require('../services/prompter/database-prompter');
const EnvironmentManager = require('../services/environment-manager');
const { handleError } = require('../utils/error');
const { buildDatabaseUrl } = require('../utils/database-url');

const spinner = singletonGetter(Spinner);

const ERROR_MESSAGE_PROJECT_IN_V1 = 'This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_NOT_ADMIN_USER = "You need the 'Admin' role to create a development environment on this project.";
const ERROR_MESSAGE_PROJECT_NOT_FOUND = 'Your project was not found. Please check your environment secret.';
const ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT = 'You cannot create your development environment until this project has either a remote or a production environment.';
const ERROR_MESSAGE_ENVIRONMENT_OWNER_UNICITY = 'You already have a development environment on this project.';

const OPTIONS_DATABASE = [
  'dbDialect',
  'dbName',
  'dbHostname',
  'dbPort',
  'dbUser',
  'dbPassword',
  'dbSchema',
  'ssl',
  'mongodbSrv',
];

const VALIDATION_REGEX_URL = /^https?:\/\/.*/i;
const VALIDATION_REGEX_HTTPS = /^http((s:\/\/.*)|(s?:\/\/(localhost|127\.0\.0\.1).*))/i;

function handleInitError(rawError) {
  const error = handleError(rawError);
  switch (error) {
    case 'Dev Workflow disabled.':
      return ERROR_MESSAGE_PROJECT_IN_V1;
    case 'Forbidden':
      return ERROR_MESSAGE_NOT_ADMIN_USER;
    case 'Not Found':
      return ERROR_MESSAGE_PROJECT_NOT_FOUND;
    case 'No production/remote environment.':
      return ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT;
    case 'A user can have only one development environment per project.':
      return ERROR_MESSAGE_ENVIRONMENT_OWNER_UNICITY;
    case 'An environment with this name already exists. Please choose another name.':
      return ERROR_MESSAGE_ENVIRONMENT_OWNER_UNICITY;
    default:
      return error;
  }
}

function validateEndpoint(input) {
  if (!VALIDATION_REGEX_URL.test(input)) {
    return 'Application input must be a valid url.';
  }
  if (!VALIDATION_REGEX_HTTPS.test(input)) {
    return 'HTTPS protocol is mandatory, except for localhost and 127.0.0.1.';
  }
  return true;
}

async function handleDatabaseConfiguration() {
  const response = await inquirer
    .prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'You don\'t have a DATABASE_URL yet. Do you need help setting it?',
    }]);

  if (!response.confirm) return null;

  const promptContent = [];
  await new DatabasePrompter(OPTIONS_DATABASE, envConfig, promptContent, { }).handlePrompts();
  return inquirer.prompt(promptContent);
}

class InitCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    try {
      spinner.start({ text: 'Analyzing your setup' });
      await spinner.attachToPromise(this.projectSelectionAndValidation());

      spinner.start({ text: 'Checking your database setup' });
      await spinner.attachToPromise(this.handleDatabaseUrlConfiguration());

      spinner.start({ text: 'Setting up your development environment' });
      await spinner.attachToPromise(this.developmentEnvironmentCreation());
    } catch (error) {
      logger.error(handleInitError(error));
    }
  }

  async projectSelectionAndValidation() {
    const parsed = this.parse(InitCommand);
    spinner.pause();
    this.config = await withCurrentProject({ ...parsed.flags });
    spinner.continue();
    const project = await new ProjectManager(this.config).getProjectForDevWorkflow();
    this.config.projectOrigin = project.origin;
  }

  async handleDatabaseUrlConfiguration() {
    if (this.config.projectOrigin !== 'In-app') {
      const isDatabaseAlreadyConfigured = !!process.env.DATABASE_URL;

      if (!isDatabaseAlreadyConfigured) {
        spinner.pause();
        const databaseConfiguration = await handleDatabaseConfiguration();
        spinner.continue();
        this.config.databaseUrl = buildDatabaseUrl(databaseConfiguration);
      }
    }
  }

  async developmentEnvironmentCreation() {
    let existingDevelopmentEnvironment;
    try {
      existingDevelopmentEnvironment = await new ProjectManager(this.config)
        .getDevelopmentEnvironmentForUser(this.config.projectId);
    } catch (error) {
      existingDevelopmentEnvironment = null;
    }

    if (!existingDevelopmentEnvironment) {
      spinner.pause();
      const prompter = await inquirer.prompt([{
        name: 'endpoint',
        message: 'Enter your local admin backend endpoint:',
        type: 'input',
        default: 'http://localhost:3310',
        validate: validateEndpoint,
      }]);
      spinner.continue();

      const newEnv = await new EnvironmentManager(this.config).createDevelopmentEnvironment(
        this.config.projectId,
        prompter.endpoint,
      );
        // JUST TO TESTING PURPOSE. WILL BE AMENDED ON NEXT STEP.
      return logger.info(`New local env created: ${newEnv.name}`);
    }
    // JUST TO TESTING PURPOSE. WILL BE AMENDED ON NEXT STEP.
    return logger.info(`Already have a local env named: ${existingDevelopmentEnvironment.name}`);
  }
}

InitCommand.description = 'Set up your development environment in your current folder.';

InitCommand.flags = {
  projectId: flags.string({
    char: 'p',
    description: 'The id of the project you want to init.',
  }),
};

module.exports = InitCommand;
