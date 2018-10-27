const _ = require('lodash');
const P = require('bluebird');
const chalk = require('chalk');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const ProjectDeserializer = require('../deserializers/project');
const EnvironmentDeserializer = require('../deserializers/environment');
const logger = require('./logger');

function EnvironmentManager(config) {

  this.listEnvironments = async () => {
    const authToken = authenticator.getAuthToken();
    let project;

    return agent
      .get(`${config.serverHost}/api/projects/${config.projectId}/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send()
      .then((response) => new EnvironmentDeserializer.deserialize(response.body));
  };

  this.getEnvironment = async (config) => {
    const authToken = authenticator.getAuthToken();
    let project;

    return agent
      .get(`${config.serverHost}/api/environments/${config.environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send()
      .then((response) => new EnvironmentDeserializer.deserialize(response.body))
      .then((environment) => {
        if (!environment) {
          logger.error(`Cannot find the environment ${chalk.bold(config.environmentId)}.`);
          process.exit(1);
        }

        return environment;
      });
  };
}

module.exports = EnvironmentManager;
