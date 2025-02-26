import type { Config } from '../../interfaces/project-create-interface';
import type ForestExpress from '../../services/dumpers/forest-express';
import type { CommandOptions } from '../../utils/option-parser';
import type { Config as OclifConfig } from '@oclif/core';

import AbstractProjectCreateCommand from '../../abstract-project-create-command';
import * as projectCreateOptions from '../../services/projects/create/options';
import { optionsToFlags } from '../../utils/option-parser';

export default class CreateCommand extends AbstractProjectCreateCommand {
  protected static readonly options: CommandOptions = {
    databaseConnectionURL: projectCreateOptions.databaseConnectionURL,
    databaseDialect: projectCreateOptions.databaseDialectV1,
    databaseName: projectCreateOptions.databaseName,
    databaseSchema: projectCreateOptions.databaseSchema,
    databaseHost: projectCreateOptions.databaseHost,
    databasePort: projectCreateOptions.databasePort,
    databaseUser: projectCreateOptions.databaseUser,
    databasePassword: projectCreateOptions.databasePassword,
    databaseSSL: { ...projectCreateOptions.databaseSSL, prompter: null }, // Replicating a bug from previous version
    mongoDBSRV: projectCreateOptions.mongoDBSRV,
    applicationHost: projectCreateOptions.applicationHost,
    applicationPort: projectCreateOptions.applicationPort,
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  private readonly dumper: ForestExpress;

  protected readonly agent = null;

  constructor(argv: string[], config: OclifConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, forestExpressDumper } = this.context;
    assertPresent({ forestExpressDumper });

    this.dumper = forestExpressDumper;
  }

  protected async dump(config: Config, schema?): Promise<void> {
    return this.dumper.dump(config, schema);
  }
}
