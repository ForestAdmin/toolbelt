const { flags } = require('@oclif/command');
const inquirer = require('inquirer');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const envConfig = require('../config');
const withCurrentProject = require('../services/with-current-project');
const spinners = require('../services/spinners');
const logger = require('../services/logger');
const ProjectManager = require('../services/project-manager');
const DatabasePrompter = require('../services/prompter/database-prompter');
const { handleError } = require('../utils/error');
const { buildDatabaseUrl } = require('../utils/database-url');

const ERROR_MESSAGE_PROJECT_IN_V1 = 'This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_NOT_ADMIN_USER = "You need the 'Admin' role to create a development environment on this project.";
const ERROR_MESSAGE_PROJECT_NOT_FOUND = 'Your project was not found. Please check your environment secret.';

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
    case 'Not Found':
      return ERROR_MESSAGE_PROJECT_NOT_FOUND;
    default:
      return error;
  }
}

async function handleDatabaseConfiguration() {
  if (process.env.DATABASE_URL) {
    return logger.info('✅ Checking your database setup');
  }

  const response = await inquirer
    .prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'You don\'t have a DATABASE_URL yet. Do you need help setting it? (Y|n)',
    }]);

  if (response.confirm) return null;

  const promptContent = [];
  await new DatabasePrompter(OPTIONS_DATABASE, envConfig, promptContent, { }).handlePrompts();
  return inquirer.prompt(promptContent);
}

class InitCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const projectSelectionAndValidationPromise = this.projectSelectionAndValidation();
    const projectSpinner = spinners.add(
      'project-selection',
      { text: 'Analyzing your setup' },
      projectSelectionAndValidationPromise,
    );
    await projectSpinner.executeAsync();

    this.handleDatabaseUrlConfiguration();
  }

  async projectSelectionAndValidation() {
    // TO BE REMOVED: JUST TO TRY THE SPINNER ;)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const parsed = this.parse(InitCommand);
    let project;
    try {
      const config = await withCurrentProject({ ...parsed.flags });
      project = await new ProjectManager(config).getProjectForDevWorkflow();
      this.config.project = project;
    } catch (error) {
      throw (handleInitError(error));
    }

    // JUST FOR TESTING PURPOSE, TO BE REMOVED LATER ON ;)
    // return logger.info(`All clear 🤙! My selected projectId is: ${project.id} and my origin is: ${project.origin}`);
  }

  async handleDatabaseUrlConfiguration() {
    if (this.config.project.origin !== 'In-app') {
      const databaseConfiguration = await handleDatabaseConfiguration();
      this.config.databaseUrl = buildDatabaseUrl(databaseConfiguration);
    }
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
