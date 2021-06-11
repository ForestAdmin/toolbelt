const { flags } = require('@oclif/command');
const makeDefaultPlan = require('../context/init');
const ProjectManager = require('../services/project-manager');
const Renderer = require('../renderers/projects');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');

class ProjectCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || makeDefaultPlan());
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(ProjectCommand);
    const config = { ...this.env, ...parsed.flags };
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
