const path = require('path');
const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class RefreshCommand extends AbstractAuthenticatedCommand {
  constructor(...args) {
    super(...args);
    this.log('schema:refresh init');
  }

  async runIfAuthenticated() {
    this.log('schema:refresh runIfAuthenticated');
  }
}

RefreshCommand.description = 'Refresh your schema by generating files that do not currently exist.';

RefreshCommand.flags = {
  config: flags.string({
    char: 'c',
    default: path.join(process.cwd(), 'config/databases.js'),
    dependsOn: [],
    description: 'Database configuration file to use.',
    exclusive: [],
    required: false,
  }),
  'output-directory': flags.string({
    char: 'o',
    dependsOn: [],
    description: 'Output directory where to generate new files.',
    exclusive: [],
    required: false,
  }),
};

RefreshCommand.args = [{}];

module.exports = RefreshCommand;