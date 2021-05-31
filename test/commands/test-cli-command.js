const Context = require('@forestadmin/context');
const { init } = require('@forestadmin/context');

const basePlan = require('../../src/context/init');

const prepareCommand = ({
  commandArgs = [],
  commandClass: CommandClass,
  commandLegacy,
  context,
}) => {
  if (commandLegacy) return commandLegacy;

  const instance = new CommandClass(commandArgs);
  instance.init(context);

  return () => instance.run();
};

const prepareContext = ({ commandLegacy, commandPlan }) => {
  if (commandLegacy) {
    init(commandPlan);

    return Context.inject();
  }

  return Context.execute(commandPlan);
};

const prepareContextPlan = ({ commandLegacy }) => {
  // FIXME: This should disappear.
  if (commandLegacy) return basePlan;

  // FIXME: Need to override things here (fs...)
  return basePlan;
};

module.exports = { prepareCommand, prepareContext, prepareContextPlan };
