const { Config } = require('@oclif/core');

const prepareCommand = ({ commandArgs = [], commandClass: CommandClass, commandPlan }) => {
  const instance = new CommandClass(commandArgs, new Config({ root: process.cwd() }), commandPlan);

  return instance;
};

module.exports = { prepareCommand };
