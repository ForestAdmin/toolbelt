const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../abstract-authenticated-command');
const logger = require('../services/logger');

class InitCommand extends AbstractAuthenticatedCommand {
  async runIfAuthenticated() {
    // TO BE REMOVED. JUST CHECKING IF THE FLAG PARSING IS WORKING HERE :)
    const parsed = this.parse(InitCommand);
    logger.info('working here 🤙 flag:', parsed.flags);
  }
}

InitCommand.description = 'Set up your development environment in your current folder.';

InitCommand.flags = {
  project: flags.string({
    char: 'p',
    description: 'The name of the project you want to init.',
  }),
};

module.exports = InitCommand;
