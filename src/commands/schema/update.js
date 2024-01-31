const { Flags } = require('@oclif/core');
const AbstractCommand = require('../../abstract-command').default;
const StaticContext = require('../../context/static');

class UpdateCommand extends AbstractCommand {
  constructor(argv, config, plan) {
    super(argv, config, plan);
    const { assertPresent, env, path, schemaService } = this.context;
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
    const parsed = await this.parse(UpdateCommand);
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

UpdateCommand.flags = (() => {
  const { assertPresent, path } = StaticContext.init();
  assertPresent({
    path,
  });

  return {
    config: Flags.string({
      char: 'c',
      default: () => path.join('config', 'databases.js'),
      dependsOn: [],
      description: 'Database configuration file to use.',
      exclusive: [],
      required: false,
    }),
    outputDirectory: Flags.string({
      char: 'o',
      dependsOn: [],
      description: 'Output directory where to generate new files.',
      exclusive: [],
      required: false,
    }),
  };
})();

UpdateCommand.args = {};

module.exports = UpdateCommand;
