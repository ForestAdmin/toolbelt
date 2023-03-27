const { Config } = require('@oclif/config');

const prepareCommand = ({ commandArgs = [], commandClass: CommandClass, commandPlan }) => {
  const instance = new CommandClass(commandArgs, new Config({ root: process.cwd() }), commandPlan);

  return instance;
};

module.exports = { prepareCommand };
