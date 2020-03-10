const { flags } = require('@oclif/command');
const EnvironmentManager = require('../services/environment-manager');
const Renderer = require('../renderers/environments');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const withCurrentProject = require('../services/with-current-project');
const envConfig = require('../config');

class EnvironmentCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const parsed = this.parse(EnvironmentCommand);
    const config = await withCurrentProject({ ...envConfig, ...parsed.flags });

    const manager = new EnvironmentManager(config);

    const environments = await manager.listEnvironments();
    new Renderer(config).render(environments);
  }
}

EnvironmentCommand.description = 'manage environments';

EnvironmentCommand.flags = {
  /*
  projectId: flags.string({
    char: 'p',
    description: 'Forest project ID',
  }),
  */
  format: flags.string({
    char: 'format',
    description: 'Ouput format',
    options: ['table', 'json'],
    default: 'table',
  }),
};

module.exports = EnvironmentCommand;
