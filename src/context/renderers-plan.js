const EnvironmentRenderer = require('../renderers/environment');
const EnvironmentsRenderer = require('../renderers/environments');
const ProjectRenderer = require('../renderers/project');
const ProjectsRenderer = require('../renderers/projects');

module.exports = (plan) => plan
  .addClass(EnvironmentRenderer)
  .addClass(EnvironmentsRenderer)
  .addClass(ProjectRenderer)
  .addClass(ProjectsRenderer);
