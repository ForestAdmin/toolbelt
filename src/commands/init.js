const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const withCurrentProject = require('../services/with-current-project');
const spinners = require('../services/spinners');
const logger = require('../services/logger');
const UserManager = require('../services/user-manager');
const ProjectManager = require('../services/project-manager');

class InitCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    try {
      const projectSelectionAndValidationPromise = this.projectSelectionAndValidation();
      const projectSpinner = spinners.add('project-selection', { text: 'Analyzing your setup' }, projectSelectionAndValidationPromise);
      await projectSpinner.executeAsync();
    } catch (error) {
      logger.error(error.message);
    }
  }

  async projectSelectionAndValidation() {
    const parsed = this.parse(InitCommand);
    const config = await withCurrentProject({ ...parsed.flags });
    // NOTICE: If a `--projectId` option was specified, no project call was done yet
    //         so we need to do it now to get the project version.
    if (parsed.flags.projectId) {
      const project = await new ProjectManager(config).getProject();
      config.projectVersion = project.version;
    }
    if (config.projectVersion !== '2') {
      throw new Error('This project does not support branches yet. Please migrate your environments from your Project settings first');
    }
    const userOnProject = await new UserManager(config).getCurrentUser();
    if (userOnProject.role !== 'admin') {
      throw new Error("You need the 'Admin' role to create a development environment on this project.");
    }
    // JUST FOR TESTING PURPOSE, TO BE REMOVED LATER ON ;)
    logger.info(`All clear 🤙! My selected projectId is: ${config.projectId} and my role: ${userOnProject.role}`);
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
