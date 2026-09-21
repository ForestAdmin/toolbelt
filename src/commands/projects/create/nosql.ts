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
    // Ask for a connection URL first; when provided, the field prompts below are skipped.
    databaseConnectionURL: {
      ...projectCreateOptions.databaseConnectionURL,
      // Mirror the field options' `exclusive: ['databaseConnectionURL']`: when any DB field
      // flag is passed on the command line, the URL prompt is dropped (scripted/CI usage
      // must not hang on a new interactive question).
      exclusive: [
        'databaseName',
        'databaseHost',
        'databasePort',
        'databaseUser',
        'databasePassword',
        'mongoDBSRV',
      ],
      filter: projectCreateOptions.trimConnectionUrl,
      validate: projectCreateOptions.validateMongoConnectionUrl,
      prompter: {
        question: 'MongoDB connection URL (leave blank to enter the details manually):',
        // The URL embeds the database password: it must be masked like the password prompt.
        secret: true,
      },
    },
    databaseName: {
      ...projectCreateOptions.databaseName,
      when: projectCreateOptions.skipWhenConnectionUrl,
    },
    databaseHost: {
      ...projectCreateOptions.databaseHost,
      when: projectCreateOptions.skipWhenConnectionUrl,
    },
    databasePort: {
      ...projectCreateOptions.databasePort,
      when: projectCreateOptions.skipWhenConnectionUrl,
      // Same reason as the SRV question below: the shared default derives the port from a
      // dialect this command only sets after prompting, so it offered none and an empty
      // answer was refused by the port validator, with no way forward but typing 27017.
      default: '27017',
    },
    databaseUser: {
      ...projectCreateOptions.databaseUser,
      when: projectCreateOptions.skipWhenConnectionUrl,
      // The shared default is 'root' for every dialect it does not read as mongodb, which is
      // this one, so the mongo path was being offered a SQL default.
      default: undefined,
    },
    databasePassword: {
      ...projectCreateOptions.databasePassword,
      when: projectCreateOptions.skipWhenConnectionUrl,
    },

    // Set prompter to null to replicate bug from previous version (we don't ask for SSL there).
    databaseSslMode: { ...projectCreateOptions.databaseSslMode, prompter: null },
    databaseSSL: { ...projectCreateOptions.databaseSSL, prompter: null },

    mongoDBSRV: {
      ...projectCreateOptions.mongoDBSRV,
      // The shared option gates this on a mongodb dialect, which this command only sets once
      // prompting has returned, so the question never appeared. On a mongo-only command the
      // engine is not in question: ask whenever the fields are being filled by hand.
      when: projectCreateOptions.skipWhenConnectionUrl,
    },
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
