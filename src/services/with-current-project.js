const inquirer = require('inquirer');
const ProjectManager = require('./project-manager');
const logger = require('./logger');

module.exports = async function withCurrentProject(config) {
  // TO BE REMOVED: JUST TO TRY THE SPINNER ;)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (config.projectId) { return config; }

  const projectManager = await new ProjectManager(config);

  const envSecret = process.env.FOREST_ENV_SECRET;
  if (envSecret) {
    const projectFromEnv = await projectManager.getByEnvSecret(envSecret);
    if (projectFromEnv) {
      return {
        ...config,
        projectId: projectFromEnv.id,
        projectVersion: projectFromEnv.version,
      };
    }
  }

  const projects = await projectManager.listProjects();
  if (projects.length) {
    if (projects.length === 1) {
      return {
        ...config,
        projectId: projects[0].id,
        projectVersion: projects[0].version,
      };
    }

    logger.pauseSpinner();
    const response = await inquirer.prompt([{
      name: 'project',
      message: 'Select your project',
      type: 'list',
      choices: projects.map((project) => ({ name: project.name, value: project.id })),
    }]);
    logger.continueSpinner();
    const selectedProject = projects.find((project) => project.id === response.project);
    return {
      ...config,
      projectId: selectedProject.id,
      projectVersion: selectedProject.version,
    };
  }
  throw new Error('You don\'t have any project yet.');
};
