const { flags } = require('@oclif/command');
const _ = require('lodash');
const defaultPlan = require('../../context/init');
const EnvironmentManager = require('../../services/environment-manager');
const Prompter = require('../../services/prompter');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class UpdateCommand extends AbstractAuthenticatedCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const { assertPresent } = this.context;
    assertPresent({ });
  }

  async runIfAuthenticated() {
    const parsed = this.parse(UpdateCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags);

    if (config.name || config.url) {
      const manager = new EnvironmentManager(config);
      await manager.updateEnvironment();
      this.logger.info('Environment updated.');
    } else {
      this.logger.error('Please provide environment name and/or url');
    }
  }
}

UpdateCommand.description = 'Update an environment.';

UpdateCommand.flags = {
  environmentId: flags.string({
    char: 'e',
    description: 'The forest environment ID to update.',
    required: true,
  }),
  name: flags.string({
    char: 'n',
    description: 'To update the environment name.',
    required: false,
  }),
  url: flags.string({
    char: 'u',
    description: 'To update the application URL.',
    required: false,
  }),
};

module.exports = UpdateCommand;
