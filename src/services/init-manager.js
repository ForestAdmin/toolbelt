const chalk = require('chalk');
const clipboardy = require('clipboardy');
const fs = require('fs');
const { EOL } = require('os');
const Context = require('@forestadmin/context');
const { handleError } = require('../utils/error');
const { generateKey } = require('../utils/key-generator');
const DatabasePrompts = require('../services/prompter/database-prompts');

const SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_IN_ENV_FILE = 'Copying the environment variables in your `.env` file';
const SUCCESS_MESSAGE_ENV_FILE_CREATED_AND_FILLED = 'Creating a new `.env` file containing your environment variables';
const SUCCESS_MESSAGE_DISPLAY_ENV_VARIABLES = 'Here are the environment variables you need to copy in your configuration file:\n';
const SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_TO_CLIPBOARD = 'Automatically copied to your clipboard!';

const ERROR_MESSAGE_PROJECT_IN_V1 = 'This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_NOT_ADMIN_USER = "You need the 'Admin' role to create a development environment on this project.";
const ERROR_MESSAGE_PROJECT_BY_ENV_NOT_FOUND = 'Your project was not found. Please check your environment secret.';
const ERROR_MESSAGE_PROJECT_BY_OPTION_NOT_FOUND = 'The project you specified does not exist.';
const ERROR_MESSAGE_NO_PRODUCTION_OR_REMOTE_ENVIRONMENT = 'You cannot create your development environment until this project has either a remote or a production environment.';
const ERROR_MESSAGE_ENVIRONMENT_OWNER_UNICITY = 'You already have a development environment on this project.';

const VALIDATION_REGEX_URL = /^https?:\/\/.*/i;
const VALIDATION_REGEX_HTTPS = /^http((s:\/\/.*)|(s?:\/\/(localhost|127\.0\.0\.1).*))/i;
const SPLIT_URL_REGEX = new RegExp('(\\w+)://([\\w\\-\\.]+)(:(\\d+))?');

const ENV_VARIABLES_AUTO_FILLING_PREFIX = '\n\n# ℹ️ The content below was automatically added by the `forest init` command ⤵️\n';

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

function handleInitError(rawError) {
  const error = handleError(rawError);
  switch (error) {
    case 'Dev Workflow disabled.':
      return ERROR_MESSAGE_PROJECT_IN_V1;
    case 'Forbidden':
      return ERROR_MESSAGE_NOT_ADMIN_USER;
    case 'Project by env secret not found':
      return ERROR_MESSAGE_PROJECT_BY_ENV_NOT_FOUND;
    case 'Project not found':
      return ERROR_MESSAGE_PROJECT_BY_OPTION_NOT_FOUND;
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
  const { env, inquirer } = Context.inject();

  const response = await inquirer
    .prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'You don\'t have a DATABASE_URL yet. Do you need help setting it?',
    }]);

  if (!response.confirm) return null;

  const promptContent = [];
  await new DatabasePrompts(OPTIONS_DATABASE, env, promptContent, { }).handlePrompts();
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

function getContentToAddInDotenvFile(environmentVariables) {
  const authSecret = generateKey();
  let contentToAddInDotenvFile = '';

  if (environmentVariables.applicationPort) {
    contentToAddInDotenvFile += `APPLICATION_PORT=${environmentVariables.applicationPort}\n`;
  }
  if (environmentVariables.databaseUrl) {
    contentToAddInDotenvFile += `DATABASE_URL=${environmentVariables.databaseUrl}\n`;
  }
  if (environmentVariables.databaseSchema) {
    contentToAddInDotenvFile += `DATABASE_SCHEMA=${environmentVariables.databaseSchema}\n`;
  }
  if (environmentVariables.databaseSSL !== undefined) {
    contentToAddInDotenvFile += `DATABASE_SSL=${environmentVariables.databaseSSL}\n`;
  }
  contentToAddInDotenvFile += `FOREST_AUTH_SECRET=${authSecret}\n`;
  contentToAddInDotenvFile += `FOREST_ENV_SECRET=${environmentVariables.forestEnvSecret}`;
  contentToAddInDotenvFile += EOL;
  return contentToAddInDotenvFile;
}

function commentExistingVariablesInAFile(fileData, environmentVariables) {
  const variablesToComment = {
    'FOREST_AUTH_SECRET=': '# FOREST_AUTH_SECRET=',
    'FOREST_ENV_SECRET=': '# FOREST_ENV_SECRET=',
  };
  if (environmentVariables.applicationPort) {
    variablesToComment['APPLICATION_PORT='] = '# APPLICATION_PORT=';
  }
  if (environmentVariables.databaseUrl) {
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

function amendDotenvFile(environmentVariables) {
  const { assertPresent, spinner } = Context.inject();
  assertPresent({ spinner });

  let newEnvFileData = getContentToAddInDotenvFile(environmentVariables);
  spinner.start({ text: SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_IN_ENV_FILE });
  const existingEnvFileData = fs.readFileSync('.env', 'utf8');
  if (existingEnvFileData) {
    const amendedExistingFileData = commentExistingVariablesInAFile(
      existingEnvFileData,
      environmentVariables,
    );
    // NOTICE: We add the prefix only if the existing file was not empty.
    newEnvFileData = amendedExistingFileData + ENV_VARIABLES_AUTO_FILLING_PREFIX + newEnvFileData;
  }
  fs.writeFileSync('.env', newEnvFileData);
  spinner.success();
}

function createDotenvFile(environmentVariables) {
  const { assertPresent, spinner } = Context.inject();
  assertPresent({ spinner });

  const contentToAdd = getContentToAddInDotenvFile(environmentVariables);
  spinner.start({ text: SUCCESS_MESSAGE_ENV_FILE_CREATED_AND_FILLED });
  fs.writeFileSync('.env', contentToAdd);
  spinner.success();
}

async function displayEnvironmentVariablesAndCopyToClipboard(environmentVariables) {
  const { logger } = Context.inject();
  const variablesToDisplay = getContentToAddInDotenvFile(environmentVariables);
  logger.info(SUCCESS_MESSAGE_DISPLAY_ENV_VARIABLES + chalk.black.bgCyan(variablesToDisplay));
  await clipboardy.write(variablesToDisplay)
    .then(() => logger.info(chalk.italic(SUCCESS_MESSAGE_ENV_VARIABLES_COPIED_TO_CLIPBOARD)))
    .catch(() => null);
}

module.exports = {
  handleInitError,
  handleDatabaseConfiguration,
  validateEndpoint,
  getApplicationPortFromCompleteEndpoint,
  amendDotenvFile,
  createDotenvFile,
  displayEnvironmentVariablesAndCopyToClipboard,
};
