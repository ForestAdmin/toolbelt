import type Logger from './services/logger';
import type { Config } from '@oclif/core';
import type { Chalk } from 'chalk';

import Context from '@forestadmin/context';
import { Command } from '@oclif/core';

import defaultPlan from './context/plan';

export default abstract class AbstractCommand extends Command {
  protected readonly context: any;

  protected readonly logger: Logger;

  protected readonly chalk: Chalk;

  constructor(argv: string[], config: Config, plan?) {
    super(argv, config);

    Context.init(plan || defaultPlan, true);

    this.context = Context.inject();
    // FIXME: Restore when no more Context.inject present in services.
    // this.context = Context.execute(plan || defaultPlan);
    const { assertPresent, logger, chalk } = this.context;
    assertPresent({ logger, chalk });

    this.logger = logger;
    this.chalk = chalk;
  }
}
