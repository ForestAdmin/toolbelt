const { flags } = require('@oclif/command');
const chalk = require('chalk');
const defaultPlan = require('../../context/plan');
const ProjectManager = require('../../services/project-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class GetCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const { assertPresent, env, projectRenderer } = this.context;
    assertPresent({ env, projectRenderer });
    this.env = env;
    this.projectRenderer = projectRenderer;
  }

  async runIfAuthenticated() {
    const parsed = this.parse(GetCommand);

    const config = { ...this.env, ...parsed.flags, ...parsed.args };

    const manager = new ProjectManager(config);
    try {
      const project = await manager.getProject(config);
      this.projectRenderer.render(project, config);
    } catch (err) {
      this.logger.error(`Cannot find the project ${chalk.bold(config.projectId)}.`);
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
