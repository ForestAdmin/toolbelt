const inquirer = require('inquirer');
const ProjectManager = require('./project-manager');
const singletonGetter = require('../services/singleton-getter');
const Spinner = require('../services/spinner');

const spinner = singletonGetter(Spinner);

module.exports = async function withCurrentProject(config) {
  if (config.projectId) { return config; }

  const projectManager = await new ProjectManager(config);

  const envSecret = config.FOREST_ENV_SECRET;
  if (envSecret) {
    const { includeLegacy } = config;
    const projectFromEnv = await projectManager.getByEnvSecret(envSecret, includeLegacy);
    if (projectFromEnv) {
      return { ...config, projectId: projectFromEnv.id };
    }
  }

  const projects = await projectManager.listProjects();
  if (projects.length) {
    if (projects.length === 1) {
      return { ...config, projectId: projects[0].id };
    }

    // NOTICE: If a spinner is running, it has to be paused during the prompt and resumed after.
    const existingSpinner = spinner.isRunning();
    if (existingSpinner) spinner.pause();
    const response = await inquirer.prompt([{
      name: 'project',
      message: 'Select your project',
      type: 'list',
      choices: projects.map((project) => ({ name: project.name, value: project.id })),
    }]);
    if (existingSpinner) spinner.continue();
    return { ...config, projectId: response.project };
  }
  throw new Error('You don\'t have any project yet.');
};
