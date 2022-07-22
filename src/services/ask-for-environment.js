const EnvironmentManager = require('./environment-manager');

module.exports = async function askForEnvironment(config, message, availableEnvironmentTypes = []) {
  const environments = await new EnvironmentManager(config).listEnvironments();
  const remoteEnvironments = environments.filter(
    (environment) => availableEnvironmentTypes.includes(environment.type),
  );

  if (remoteEnvironments.length) {
    const response = await this.inquirer.prompt([{
      name: 'environment',
      message,
      type: 'list',
      choices: remoteEnvironments.map(({ name }) => name),
    }]);
    return response.environment;
  }
  throw new Error('No remote environment.');
};
