const { Flags, Args } = require('@oclif/core');
const EnvironmentManager = require('../../services/environment-manager');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command').default;

class DiffCommand extends AbstractAuthenticatedCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, chalk, env, environmentRenderer, errorHandler } = this.context;
    assertPresent({ chalk, env });
    this.chalk = chalk;
    this.env = env;
    this.environmentRenderer = environmentRenderer;
    this.errorHandler = errorHandler;
  }

  async runAuthenticated() {
    const parsed = await this.parse(DiffCommand);
    const config = { ...this.env, ...parsed.flags, ...parsed.args };
    const manager = new EnvironmentManager(config);

    const { environmentIdFrom, environmentIdTo } = config;
    try {
      const [apimapFrom, apimapTo] = await Promise.all([
        manager.getEnvironmentApimap(environmentIdFrom),
        manager.getEnvironmentApimap(environmentIdTo),
      ]);

      this.environmentRenderer.renderApimapDiff(apimapFrom, apimapTo);
    } catch (error) {
      this.logger.error(
        `Cannot fetch the environments ${this.chalk.bold(environmentIdFrom)} and ${this.chalk.bold(
          environmentIdTo,
        )}.`,
      );
      this.logger.error(manager.handleEnvironmentError(error));
    }
  }
}

DiffCommand.description = 'Allow to compare two environment schemas';

DiffCommand.flags = {
  help: Flags.boolean({
    description: 'Display usage information.',
  }),
};

DiffCommand.args = {
  environmentIdFrom: Args.string({
    name: 'environmentIdFrom',
    required: true,
    description: 'ID of an environment to compare.',
  }),
  environmentIdTo: Args.string({
    name: 'environmentIdFrom',
    required: true,
    description: 'ID of an environment to compare.',
  }),
};

module.exports = DiffCommand;
