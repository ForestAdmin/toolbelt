const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');

class CreateCommand extends AbstractAuthenticatedCommand {
  constructor(...args) {
    super(...args);
    this.log('projects:create init');
  }

  async runIfAuthenticated() {
    this.log('projects:create runIfAuthenticated');
  }
}

CreateCommand.description = 'Create a Forest API.';

CreateCommand.flags = {
  'application-host': flags.string({
    char: 'H',
    dependsOn: [],
    description: 'Hostname of your admin backend application.',
    exclusive: ['application-port'],
    required: false,
  }),
  'application-port': flags.string({
    char: 'p',
    dependsOn: [],
    description: 'Port of your admin backend application.',
    exclusive: ['application-host'],
    required: false,
  }),
  'connection-url': flags.string({
    char: 'c',
    dependsOn: [],
    description: 'Enter the database credentials with a connection URL.',
    exclusive: ['ssl'],
    required: false,
  }),
  email: flags.string({
    char: 'e',
    dependsOn: [],
    description: 'Your Forest Admin account email.',
    exclusive: [],
    required: false,
  }),
  password: flags.string({
    char: 'P',
    dependsOn: ['email'],
    description: 'Your Forest Admin account password.',
    exclusive: ['token'],
    required: false,
  }),
  schema: flags.string({
    char: 's',
    dependsOn: [],
    description: 'Enter your database schema.',
    exclusive: [],
    required: false,
  }),
  ssl: flags.boolean({
    char: 'S',
    default: false,
    dependsOn: [],
    description: 'Use SSL for database connection.',
    exclusive: ['connection-url'],
    required: true,
  }),
  token: flags.string({
    char: 't',
    dependsOn: ['email'],
    description: 'Your Forest Admin account token.',
    exclusive: ['password'],
    required: false,
  }),
};

CreateCommand.args = [
  {
    name: 'appName',
    required: true,
    description: 'Name of the project to create.',
  },
];

module.exports = CreateCommand;
