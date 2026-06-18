import type { Config } from '../../../interfaces/project-create-interface';
import type AgentNodeJs from '../../../services/dumpers/agent-nodejs';
import type { CommandOptions } from '../../../utils/option-parser';
import type { Config as OclifConfig } from '@oclif/core';

import AbstractProjectCreateCommand from '../../../abstract-project-create-command';
import * as projectCreateOptions from '../../../services/projects/create/options';
import Agents from '../../../utils/agents';
import { optionsToFlags } from '../../../utils/option-parser';

export default class DemoCommand extends AbstractProjectCreateCommand {
  protected static options: CommandOptions = {
    applicationHost: projectCreateOptions.applicationHost,
    applicationPort: projectCreateOptions.applicationPort,
    language: projectCreateOptions.language,
  };

  /** @see https://oclif.io/docs/args */
  static override readonly args = AbstractProjectCreateCommand.args;

  /** @see https://oclif.io/docs/flags */
  static override readonly flags = optionsToFlags(this.options);

  static override readonly description =
    'Create a new Forest Admin project with demo data — no database required.';

  private readonly dumper: AgentNodeJs;

  protected readonly agent = Agents.NodeJS;

  // Demo runs on an in-memory dummy datasource: no DB connection, no introspection.
  protected override readonly requiresDatabase = false;

  constructor(argv: string[], config: OclifConfig, plan?) {
    super(argv, config, plan);

    const { assertPresent, agentNodejsDumper } = this.context;

    assertPresent({ agentNodejsDumper });

    this.dumper = agentNodejsDumper;
  }

  protected override async dump(config: Config) {
    return this.dumper.dump({ ...config, isDemo: true });
  }

  protected override logNextSteps(): void {
    this.logger.info('This demo runs on in-memory sample data — no database required.');
    this.logger.info(
      `Next step — connect your real database: ${this.chalk.bold('forest projects:create:sql')}.`,
    );
  }
}
