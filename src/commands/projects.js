const { flags } = require('@oclif/command');
const _ = require('lodash');
const defaultPlan = require('../context/init');
const ProjectManager = require('../services/project-manager');
const Renderer = require('../renderers/projects');
const Prompter = require('../services/prompter');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');

class ProjectCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const { assertPresent } = this.context;
    assertPresent({ });
  }

  async runIfAuthenticated() {
    const parsed = this.parse(ProjectCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags);

    const manager = new ProjectManager(config);
    const projects = await manager.listProjects();
    new Renderer(config).render(projects);
  }
}

ProjectCommand.description = 'Manage projects.';

ProjectCommand.flags = {
  format: flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = ProjectCommand;
