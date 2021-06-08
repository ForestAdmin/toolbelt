const prepareCommand = ({
  commandArgs = [],
  commandClass: CommandClass,
  commandPlan,
}) => {
  const instance = new CommandClass(commandArgs);
  instance.init(commandPlan);

  return instance;
};

module.exports = { prepareCommand };
