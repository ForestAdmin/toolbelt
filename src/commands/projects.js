const { flags } = require('@oclif/command');
const ProjectManager = require('../services/project-manager');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command').default;

class ProjectCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env, projectsRenderer } = this.context;
    assertPresent({ env, projectsRenderer });
    this.env = env;
    this.projectsRenderer = projectsRenderer;
  }

  async runAuthenticated() {
    const parsed = this.parse(ProjectCommand);
    const config = { ...this.env, ...parsed.flags };
    const manager = new ProjectManager(config);
    const projects = await manager.listProjects();

    this.projectsRenderer.render(projects, config);
  }
}

ProjectCommand.aliases = ['projects:list'];

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
