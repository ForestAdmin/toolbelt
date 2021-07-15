const Context = require('@forestadmin/context');

const ProjectManager = require('./project-manager');

module.exports = async function withCurrentProject(config) {
  const { assertPresent, inquirer, spinner } = Context.inject();
  assertPresent({ inquirer, spinner });

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
