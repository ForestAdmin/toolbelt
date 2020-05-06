const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const withCurrentProject = require('../services/with-current-project');
const spinners = require('../services/spinners');
const logger = require('../services/logger');
const ProjectManager = require('../services/project-manager');
const handleError = require('../services/error-manager');

const ERROR_MESSAGE_PROJECT_IN_V1 = 'This project does not support branches yet. Please migrate your environments from your Project settings first.';
const ERROR_MESSAGE_NOT_ADMIN_USER = "You need the 'Admin' role to create a development environment on this project.";

function handleInitError(rawError) {
  const error = handleError(rawError);
  switch (error) {
    case 'Dev Workflow disabled.':
      return ERROR_MESSAGE_PROJECT_IN_V1;
    case 'Forbidden':
      return ERROR_MESSAGE_NOT_ADMIN_USER;
    case 'Not Found':
      return ERROR_MESSAGE_PROJECT_IN_V1;
    default:
      return error;
  }
}

class InitCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const projectSelectionAndValidationPromise = this.projectSelectionAndValidation();
    const projectSpinner = spinners.add('project-selection', { text: 'Analyzing your setup' }, projectSelectionAndValidationPromise);
    await projectSpinner.executeAsync();
  }

  async projectSelectionAndValidation() {
    // TO BE REMOVED: JUST TO TRY THE SPINNER ;)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const parsed = this.parse(InitCommand);
    let project;
    try {
      const config = await withCurrentProject({ ...parsed.flags });
      project = await new ProjectManager(config).getProjectForDevWorkflow();
    } catch (error) {
      throw (handleInitError(error));
    }

    // JUST FOR TESTING PURPOSE, TO BE REMOVED LATER ON ;)
    return logger.info(`All clear 🤙! My selected projectId is: ${project.id} and my origin is: ${project.origin}`);
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
