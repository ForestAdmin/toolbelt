const clipboardy = require('clipboardy');
const fs = require('fs');
const chalk = require('chalk');
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
const { generateKey } = require('../utils/key-generator');
const { handleError } = require('../utils/error');
const { buildDatabaseUrl } = require('../utils/database-url');

const spinner = singletonGetter(Spinner);

const ERROR_MESSAGE_PROJECT_IN_V1 = 'This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_NOT_ADMIN_USER = "You need the 'Admin' role to create a development environment on this project.";
const ERROR_MESSAGE_PROJECT_NOT_FOUND = 'Your project was not found. Please check your environment secret.';
const ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT = 'You cannot create your development environment until this project has either a remote or a production environment.';
const ERROR_MESSAGE_ENVIRONMENT_OWNER_UNICITY = 'You already have a development environment on this project.';

const SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_IN_ENV_FILE = 'Copying the environment variables in your `.env` file';
const SUCCESS_MESSAGE_ENV_FILE_CREATED_AND_FILLED = 'Creating a new `.env` file containing your environment variables';
const SUCCESS_MESSAGE_DISPLAY_ENV_VARIABLES = 'Here are the environment variables you need to copy in your configuration file:\n';
const SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_TO_CLIPBOARD = 'Automatically copied to your clipboard!';
const SUCCESS_MESSAGE_ALL_SET_AND_READY = "You're now set up and ready to develop on Forest Admin";
const SUCCESS_MESSAGE_LEARN_MORE_ON_CLI_USAGE = 'To learn more about the recommended usage of this CLI, please visit https://docs.forestadmin.com/getting-started/a-page-on-forest-cli.';

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
const SPLIT_URL_REGEX = new RegExp('(\\w+)://([\\w\\-\\.]+)(:(\\d+))?');

const PROMPT_MESSAGE_AUTO_FILLING_ENV_FILE = 'Do you want your current folder `.env` file to be completed automatically with your environment variables?';
const PROMPT_MESSAGE_AUTO_CREATING_ENV_FILE = 'Do you want a new `.env` file (containing your environment variables) to be automatically created in your current folder?';
const ENV_VARIABLES_AUTO_FILLING_PREFIX = '\n\n# ℹ️ The content below was automatically added by the `forest init` command ⤵️\n';

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

function validateEndpoint(input) {
  if (!VALIDATION_REGEX_URL.test(input)) {
    return 'Application input must be a valid url.';
  }
  if (!VALIDATION_REGEX_HTTPS.test(input)) {
    return 'HTTPS protocol is mandatory, except for localhost and 127.0.0.1.';
  }
  return true;
}

function getApplicationPortFromCompleteEndpoint(endpoint) {
  return endpoint.match(SPLIT_URL_REGEX)[4];
}

function getContentToAddInDotenvFile(config) {
  const authSecret = generateKey();
  let contentToAddInDotenvFile = '';

  if (config.applicationPort) {
    contentToAddInDotenvFile += `APPLICATION_PORT=${config.applicationPort}\n`;
  }
  if (config.databaseUrl) {
    contentToAddInDotenvFile += `DATABASE_URL=${config.databaseUrl}\n`;
  }
  if (config.databaseSchema) {
    contentToAddInDotenvFile += `DATABASE_SCHEMA=${config.databaseSchema}\n`;
  }
  if (config.databaseSSL !== undefined) {
    contentToAddInDotenvFile += `DATABASE_SSL=${config.databaseSSL}\n`;
  }
  contentToAddInDotenvFile += `FOREST_AUTH_SECRET=${authSecret}\n`;
  contentToAddInDotenvFile += `FOREST_ENV_SECRET=${config.forestEnvSecret}`;
  return contentToAddInDotenvFile;
}

function commentExistingVariablesInAFile(fileData, config) {
  const variablesToComment = {
    'FOREST_AUTH_SECRET=': '# FOREST_AUTH_SECRET=',
    'FOREST_ENV_SECRET=': '# FOREST_ENV_SECRET=',
  };
  if (config.applicationPort) {
    variablesToComment['APPLICATION_PORT='] = '# APPLICATION_PORT=';
  }
  if (config.databaseUrl) {
    variablesToComment['DATABASE_URL='] = '# DATABASE_URL=';
    variablesToComment['DATABASE_SCHEMA='] = '# DATABASE_SCHEMA=';
    variablesToComment['DATABASE_SSL='] = '# DATABASE_SSL=';
  }
  const variablesToCommentRegex = new RegExp(
    Object.keys(variablesToComment).map((key) => `((?<!# )${key})`).join('|'),
    'g',
  );
  return fileData.replace(variablesToCommentRegex, (match) => variablesToComment[match]);
}

function amendDotenvFile(config, variablesToAdd) {
  let newEnvFileData = variablesToAdd;
  spinner.start({ text: SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_IN_ENV_FILE });
  const existingEnvFileData = fs.readFileSync('.env', 'utf8');
  if (existingEnvFileData) {
    const amendedExistingFileData = commentExistingVariablesInAFile(existingEnvFileData, config);
    // NOTICE: We add the prefix only if the existing file was not empty.
    newEnvFileData = amendedExistingFileData + ENV_VARIABLES_AUTO_FILLING_PREFIX + newEnvFileData;
  }
  fs.writeFileSync('.env', newEnvFileData);
  spinner.success();
}

function createDotenvFile(variablesToAdd) {
  spinner.start({ text: SUCCESS_MESSAGE_ENV_FILE_CREATED_AND_FILLED });
  fs.writeFileSync('.env', variablesToAdd);
  spinner.success();
}

async function displayEnvironmentVariablesAndCopyToClipboard(variables) {
  logger.info(SUCCESS_MESSAGE_DISPLAY_ENV_VARIABLES + chalk.black.bgCyan(variables));
  await clipboardy.write(variables)
    .then(() => logger.info(chalk.italic(SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_TO_CLIPBOARD)))
    .catch(() => null);
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

      await this.environmentVariablesAutoFilling();

      spinner.start({ text: SUCCESS_MESSAGE_ALL_SET_AND_READY });
      spinner.success();
      logger.info(SUCCESS_MESSAGE_LEARN_MORE_ON_CLI_USAGE);
    } catch (error) {
      const exitMessage = handleInitError(error);
      this.error(exitMessage, { exit: 1 });
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
        if (databaseConfiguration) {
          this.config.databaseUrl = buildDatabaseUrl(databaseConfiguration);
          this.config.databaseSchema = databaseConfiguration.dbSchema;
          this.config.databaseSSL = databaseConfiguration.ssl;
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
      spinner.pause();
      const prompter = await inquirer.prompt([{
        name: 'endpoint',
        message: 'Enter your local admin backend endpoint:',
        type: 'input',
        default: 'http://localhost:3310',
        validate: validateEndpoint,
      }]);
      spinner.continue();

      developmentEnvironment = await new EnvironmentManager(this.config)
        .createDevelopmentEnvironment(this.config.projectId, prompter.endpoint);
    }
    this.config.forestEnvSecret = developmentEnvironment.secretKey;
    this.config.applicationPort = getApplicationPortFromCompleteEndpoint(
      developmentEnvironment.apiEndpoint,
    );
  }

  async environmentVariablesAutoFilling() {
    const contentToAddInDotenvFile = getContentToAddInDotenvFile(this.config);

    if (this.config.projectOrigin !== 'In-app') {
      const existingEnvFile = fs.existsSync('.env');
      const response = await inquirer
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
            ? amendDotenvFile(this.config, contentToAddInDotenvFile)
            : createDotenvFile(contentToAddInDotenvFile);
        } catch (error) {
          return displayEnvironmentVariablesAndCopyToClipboard(contentToAddInDotenvFile);
        }
      }
    }
    return displayEnvironmentVariablesAndCopyToClipboard(contentToAddInDotenvFile);
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
