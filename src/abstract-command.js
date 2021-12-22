const { Command, flags } = require('@oclif/command');
const Context = require('@forestadmin/context');

const defaultPlan = require('./context/default-plan');

class AbstractCommand extends Command {
  init(plan) {
    Context.init(plan || defaultPlan);
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

// NOTICE: Exports flag types within base command to remove need for
//         requiring @oclif/command in all command files.
AbstractCommand.flags = flags;

module.exports = AbstractCommand;
