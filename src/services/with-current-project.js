require('dotenv').config();
const inquirer = require('inquirer');
const ProjectManager = require('./project-manager');

module.exports = async function withCurrentProject(config) {
  if (config.projectId) { return config; }

  const envSecret = process.env.FOREST_ENV_SECRET;
  if (envSecret) {
    const projectFromEnv = await new ProjectManager(config).getByEnvSecret(envSecret);
    if (projectFromEnv) {
      return { ...config, projectId: projectFromEnv.id };
    }
  }

  const projects = await new ProjectManager(config).listProjects();
  if (projects.length) {
    if (projects.length === 1) {
      return { ...config, projectId: projects[0].id };
    }

    const response = await inquirer.prompt([{
      name: 'project',
      message: 'Select your project',
      type: 'list',
      choices: projects.map((project) => ({ name: project.name, value: project.id })),
    }]);
    return { ...config, projectId: response.project };
  }
  throw new Error('oh no.');
};
