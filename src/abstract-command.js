const { Command } = require('@oclif/command');
const Context = require('@forestadmin/context');
const basePlan = require('./context/init');

module.exports = class AbstractCommand extends Command {
  init(context) {
    this.context = context || Context.execute(basePlan);
    const { assertPresent, logger, chalk } = this.context;
    assertPresent({ logger, chalk });

    /** @protected @readonly */
    this.logger = logger;

    /** @protected @readonly */
    this.chalk = chalk;
  }
};
