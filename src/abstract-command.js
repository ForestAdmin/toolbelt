const { Command } = require('@oclif/command');
const Context = require('@forestadmin/context');
const makeDefaultPlan = require('./context/init');

module.exports = class AbstractCommand extends Command {
  init(plan) {
    Context.init(plan || makeDefaultPlan());
    this.context = Context.inject();
    // FIXME: Restore when no more Context.inject present in services.
    // this.context = Context.execute(plan || makeDefaultPlan());
    const { assertPresent, logger, chalk } = this.context;
    assertPresent({ logger, chalk });

    /** @protected @readonly */
    this.logger = logger;

    /** @protected @readonly */
    this.chalk = chalk;
  }
};
