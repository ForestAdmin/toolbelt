const makeDefaultPlan = require('../../src/context/init');

const prepareCommand = ({
  commandArgs = [],
  commandClass: CommandClass,
  commandPlan,
}) => {
  const instance = new CommandClass(commandArgs);
  instance.init(commandPlan);

  return () => instance.run();
};

// FIXME: Need to override things here (fs...)
const prepareContextPlan = () => makeDefaultPlan();

module.exports = { prepareCommand, prepareContextPlan };
