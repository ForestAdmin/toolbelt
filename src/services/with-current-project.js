require('dotenv').config();
const inquirer = require('inquirer');
const ProjectManager = require('./project-manager');

module.exports = async function withCurrentProject(config) {
  function getProjectByEnvSecret() {
    // TODO
    return false;
  }

  if (config.projectId) { return config; }

  const envSecret = process.env.FOREST_ENV_SECRET;
  if (envSecret) {
    const projectFromEnv = getProjectByEnvSecret(envSecret);
    if (projectFromEnv) {
      return { ...config, projectId: projectFromEnv.id };
    }
  }

  const projects = await new ProjectManager(config).listProjects();
  if (projects.length) {
    if (projects.length === 1) {
      return { ...config, projectId: projects[0].id };
    }

    const projectFromPrompt = await inquirer.prompt([{
      name: 'Select your project',
      type: 'list',
      choices: projects.map((project) => ({ name: project.name, value: project.id })),
    }]);
    return { ...config, projectId: projectFromPrompt.id };
  }

  
  throw new Error('oh no.');
}
