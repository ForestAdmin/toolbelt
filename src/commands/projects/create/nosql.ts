import type { Config } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type { ProjectCreateOptions } from '../../../services/projects/create/options';
import type { CommandOptions } from '../../../utils/option-parser';
import type { Config as OclifConfig } from '@oclif/core';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import * as projectCreateOptions from '../../../services/projects/create/options';
import Agents from '../../../utils/agents';
import { optionsToFlags } from '../../../utils/option-parser';

export default class NosqlCommand extends AbstractProjectCreateCommand {
  protected static readonly options: CommandOptions = {
    databaseConnectionURL: projectCreateOptions.databaseConnectionURL,
    databaseName: projectCreateOptions.databaseName,
    databaseHost: projectCreateOptions.databaseHost,
    databasePort: projectCreateOptions.databasePort,
    databaseUser: projectCreateOptions.databaseUser,
    databasePassword: projectCreateOptions.databasePassword,

    // Set prompter to null to replicate bug from previous version (we don't ask for SSL there).
    databaseSslMode: { ...projectCreateOptions.databaseSslMode, prompter: null },
    databaseSSL: { ...projectCreateOptions.databaseSSL, prompter: null },

    mongoDBSRV: projectCreateOptions.mongoDBSRV,
    applicationHost: projectCreateOptions.applicationHost,
    applicationPort: projectCreateOptions.applicationPort,
    language: projectCreateOptions.language,
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  protected readonly agent = Agents.NodeJS;

  private readonly dumper: AgentNodeJs;

  constructor(argv: string[], config: OclifConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper } = this.context;

    assertPresent({ agentNodejsDumper });

    this.dumper = agentNodejsDumper;
  }

  protected override async dump(config: Config) {
    return this.dumper.dump(config);
  }

  protected override async getCommandOptions(): Promise<ProjectCreateOptions> {
    return {
      ...(await super.getCommandOptions()),
      databaseDialect: 'mongodb',
    };
  }
}
