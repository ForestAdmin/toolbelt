const { Command, flags } = require('@oclif/command');
const _ = require('lodash');
const ProjectManager = require('../../services/project-manager');
const Renderer = require('../../renderers/projects');
const Prompter = require('../../services/prompter');

class ProjectCommand extends Command {
  async run() {
    const parsed = this.parse(ProjectCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags);

    const manager = new ProjectManager(config);
    const projects = await manager.listProjects();
    new Renderer(config).render(projects);
  }
}

ProjectCommand.description = 'List existing projects.';

ProjectCommand.flags = {
  format: flags.string({
    char: 'format',
    description: 'Ouput format',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = ProjectCommand;
