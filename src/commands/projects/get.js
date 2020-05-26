const { flags } = require('@oclif/command');
const _ = require('lodash');
const chalk = require('chalk');
const ProjectManager = require('../../services/project-manager');
const Renderer = require('../../renderers/project');
const Prompter = require('../../services/prompter');
const logger = require('../../services/logger');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class GetCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const parsed = this.parse(GetCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags, parsed.args);

    const manager = new ProjectManager(config);
    try {
      const project = await manager.getProject(config);
      new Renderer(config).render(project);
    } catch (err) {
      logger.error(`Cannot find the project ${chalk.bold(config.projectId)}.`);
    }
  }
}

GetCommand.description = 'Get the configuration of a project.';

GetCommand.flags = {
  format: flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

GetCommand.args = [{
  name: 'projectId', required: true, description: 'ID of a project.',
}];

module.exports = GetCommand;
