const Context = require('@forestadmin/context');

const EnvironmentManager = require('./environment-manager');

module.exports = async function askForEnvironment(config, message, availableEnvironmentTypes = []) {
  const { assertPresent, inquirer } = Context.inject();
  assertPresent({ inquirer });

  const environments = await new EnvironmentManager(config).listEnvironments();
  const availableEnvironments = environments.filter(
    (environment) => availableEnvironmentTypes.includes(environment.type),
  );

  if (availableEnvironments.length) {
    const response = await inquirer.prompt([{
      name: 'environment',
      message,
      type: 'list',
      choices: availableEnvironments.map(({ name }) => name),
    }]);
    return response.environment;
  }
  throw new Error('No remote environment.');
};
