import type { Chalk } from 'chalk';
import type * as Config from '@oclif/config';
import { Command } from '@oclif/command';
import Context from '@forestadmin/context';
import type Logger from './services/logger';
import defaultPlan from './context/plan';

export default abstract class AbstractCommand extends Command {
  protected context: any;

  protected logger: Logger;

  protected chalk: Chalk;

  constructor(argv: string[], config: Config.IConfig, plan?: any) {
    super(argv, config);

    Context.init(plan || defaultPlan, true);

    this.context = Context.inject();
    // FIXME: Restore when no more Context.inject present in services.
    // this.context = Context.execute(plan || defaultPlan);
    const { assertPresent, logger, chalk } = this.context;
    assertPresent({ logger, chalk });

    /** @protected @readonly */
    this.logger = logger;

    /** @protected @readonly */
    this.chalk = chalk;
  }
}
