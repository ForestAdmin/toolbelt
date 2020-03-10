const { flags } = require('@oclif/command');
const _ = require('lodash');
const EnvironmentManager = require('../../services/environment-manager');
const logger = require('../../services/logger');
const Prompter = require('../../services/prompter');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class CreateCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    const parsed = this.parse(CreateCommand);

    let config = await Prompter([]);
    config = _.merge(config, parsed.flags);

    if (config.name || config.url) {
      const manager = new EnvironmentManager(config);
      await manager.updateEnvironment();
      logger.info('Environment updated.');
    } else {
      logger.error('Please provide environment name and/or url');
    }

  }
}

CreateCommand.description = 'update an environment';

CreateCommand.flags = {
  environmentId: flags.string({
    char: 'e',
    description: 'Forest environment ID',
    required: true,
  }),
  name: flags.string({
    char: 'n',
    description: 'Environment name',
    required: false,
  }),
  url: flags.string({
    char: 'u',
    description: 'Application URL',
    required: false,
  }),
};

module.exports = CreateCommand;
