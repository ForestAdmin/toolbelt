const { Command } = require('@oclif/command');
const Context = require('@forestadmin/context');
const defaultPlan = require('./context/init');

module.exports = class AbstractCommand extends Command {
  init(plan) {
    this.context = Context.execute(plan || defaultPlan);
    const { assertPresent, logger, chalk } = this.context;
    assertPresent({ logger, chalk });

    /** @protected @readonly */
    this.logger = logger;

    /** @protected @readonly */
    this.chalk = chalk;
  }
};
