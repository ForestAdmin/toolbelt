const { flags } = require('@oclif/command');
const chalk = require('chalk');
const Context = require('@forestadmin/context');
const plan = require('../../context/init');
const EnvironmentManager = require('../../services/environment-manager');
const Renderer = require('../../renderers/environment');
const logger = require('../../services/logger');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class GetCommand extends AbstractAuthenticatedCommand {
  init(context) {
    this.context = context || Context.execute(plan);
    const { assertPresent, env } = this.context;
    assertPresent({ env });
    this.env = env;

    super.init();
  }

  async runIfAuthenticated() {
    const parsed = this.parse(GetCommand);
    const config = { ...this.env, ...parsed.flags, ...parsed.args };
    const manager = new EnvironmentManager(config);

    try {
      const environment = await manager.getEnvironment(config.environmentId);
      new Renderer(config).render(environment);
    } catch (err) {
      logger.error(`Cannot find the environment ${chalk.bold(config.environmentId)}.`);
    }
  }
}

GetCommand.description = 'Get the configuration of an environment.';

GetCommand.flags = {
  format: flags.string({
    char: 'format',
    description: 'Ouput format.',
    options: ['table', 'json'],
    default: 'table',
  }),
};

GetCommand.args = [{
  name: 'environmentId', required: true, description: 'ID of an environment.',
}];

module.exports = GetCommand;
