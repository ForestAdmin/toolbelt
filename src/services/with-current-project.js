const inquirer = require('inquirer');
const ProjectManager = require('./project-manager');
const spinner = require('../services/spinner-instance');

module.exports = async function withCurrentProject(config) {
  if (config.projectId) { return config; }

  const projectManager = await new ProjectManager(config);

  const envSecret = process.env.FOREST_ENV_SECRET;
  if (envSecret) {
    const projectFromEnv = await projectManager.getByEnvSecret(envSecret);
    if (projectFromEnv) {
      return { ...config, projectId: projectFromEnv.id };
    }
  }

  const projects = await projectManager.listProjects();
  if (projects.length) {
    if (projects.length === 1) {
      return { ...config, projectId: projects[0].id };
    }

    spinner.pause();
    const response = await inquirer.prompt([{
      name: 'project',
      message: 'Select your project',
      type: 'list',
      choices: projects.map((project) => ({ name: project.name, value: project.id })),
    }]);
    spinner.continue();
    return { ...config, projectId: response.project };
  }
  throw new Error('You don\'t have any project yet.');
};
