/* eslint-disable global-require */
module.exports = (plan) => plan
  .addUsingClass('environmentRenderer', () => require('../renderers/environment'))
  .addUsingClass('environmentsRenderer', () => require('../renderers/environments'))
  .addUsingClass('projectRenderer', () => require('../renderers/project'))
  .addUsingClass('projectsRenderer', () => require('../renderers/projects'));
