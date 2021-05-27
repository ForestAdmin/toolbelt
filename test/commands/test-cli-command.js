const Context = require('@forestadmin/context');
const { init } = require('@forestadmin/context');

const basePlan = require('../../src/context/init');

const prepareCommand = ({ commandLegacy, commandClass: CommandClass, commandArgs }) => {
  if (commandLegacy) {
    init(basePlan);
    return { command: commandLegacy, context: Context.getInstance() };
  }
  const instance = new CommandClass(commandArgs);
  const context = Context.execute(basePlan);
  instance.init(context);
  return { command: () => instance.run(), context };
};

module.exports = { prepareCommand };
