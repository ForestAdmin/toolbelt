const Context = require('@forestadmin/context');

const AbstractCommand = require('../../abstract-command');
const defaultPlan = require('../../context/plan');

class UpdateCommand extends AbstractCommand {
  init(plan) {
    super.init(plan || defaultPlan);
    const {
      assertPresent,
      env,
      path,
      schemaService,
    } = this.context;
    assertPresent({
      env,
      path,
      schemaService,
    });
    this.env = env;
    this.path = path;
    this.schemaService = schemaService;
  }

  async run() {
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
  config: AbstractCommand.flags.string({
    char: 'c',
    default: () => Context.inject().path.join('config', 'databases.js'),
    dependsOn: [],
    description: 'Database configuration file to use.',
    exclusive: [],
    required: false,
  }),
  outputDirectory: AbstractCommand.flags.string({
    char: 'o',
    dependsOn: [],
    description: 'Output directory where to generate new files.',
    exclusive: [],
    required: false,
  }),
};

UpdateCommand.args = [];

module.exports = UpdateCommand;
