const path = require('path');
const Context = require('@forestadmin/context');
const { flags } = require('@oclif/command');
const AbstractAuthenticatedCommand = require('../../abstract-authenticated-command');
const initContext = require('../../context/init');

class UpdateCommand extends AbstractAuthenticatedCommand {
  constructor(...args) {
    super(...args);
    this.plan = initContext;
    const { assertPresent, env, schemaService } = this.getContext();
    assertPresent({ env, schemaService });
    this.env = env;
    this.schemaService = schemaService;
  }

  getContext() {
    return Context.execute(this.plan);
  }

  async runIfAuthenticated() {
    const parsed = this.parse(UpdateCommand);
    const commandOptions = { ...parsed.flags, ...parsed.args };

    const options = {
      isUpdate: true,
      outputDirectory: commandOptions.outputDirectory,
      dbSchema: this.env.DATABASE_SCHEMA,
      dbConfigPath: commandOptions.config,
    };

    await this.schemaService.update(options);
  }
}

UpdateCommand.description = 'Refresh your schema by generating files that do not currently exist.';

UpdateCommand.flags = {
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

UpdateCommand.args = [{}];

module.exports = UpdateCommand;
