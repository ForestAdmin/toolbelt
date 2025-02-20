import type { Config, DbConfig } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type { CommandOptions } from '../../../utils/option-parser';
import type { Config as OclifConfig } from '@oclif/core';

import { introspect } from '@forestadmin/datasource-sql';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import * as projectCreateOptions from '../../../services/projects/create/options';
import Agents from '../../../utils/agents';
import { optionsToFlags } from '../../../utils/option-parser';

export default class SqlCommand extends AbstractProjectCreateCommand {
  protected static options: CommandOptions = {
    databaseConnectionURL: projectCreateOptions.databaseConnectionURL,
    databaseDialect: projectCreateOptions.databaseDialectSqlV2,
    databaseName: projectCreateOptions.databaseName,
    databaseSchema: projectCreateOptions.databaseSchema,
    databaseHost: projectCreateOptions.databaseHost,
    databasePort: projectCreateOptions.databasePort,
    databaseUser: projectCreateOptions.databaseUser,
    databasePassword: projectCreateOptions.databasePassword,

    // Set prompter to null to replicate bug from previous version (we don't ask for SSL there).
    databaseSslMode: { ...projectCreateOptions.databaseSslMode, prompter: null },
    databaseSSL: { ...projectCreateOptions.databaseSSL, prompter: null },

    applicationHost: projectCreateOptions.applicationHost,
    applicationPort: projectCreateOptions.applicationPort,
    language: projectCreateOptions.language,
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  private readonly dumper: AgentNodeJs;

  protected readonly agent = Agents.NodeJS;

  constructor(argv: string[], config: OclifConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper } = this.context;

    assertPresent({ agentNodejsDumper });

    this.dumper = agentNodejsDumper;
  }

  protected override async dump(config: Config) {
    const dumpPromise = this.dumper.dump(config);
    await this.spinner.attachToPromise(dumpPromise);
  }

  protected override async testDatabaseConnection(dbConfig: DbConfig) {
    this.spinner.start({ text: 'Testing connection to your database' });

    const connectionPromise = introspect({
      uri: dbConfig.dbConnectionUrl,
      dialect: dbConfig.dbDialect as Exclude<DbConfig['dbDialect'], 'mongodb'>,
      host: dbConfig.dbHostname,
      database: dbConfig.dbName,
      password: dbConfig.dbPassword,
      port: dbConfig.dbPort,
      schema: dbConfig.dbSchema,
      sslMode: dbConfig.dbSslMode,
      username: dbConfig.dbUser,
    });

    await this.spinner.attachToPromise(connectionPromise);
  }
}
