const _ = require('lodash');
const P = require('bluebird');
const chalk = require('chalk');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const EnvironmentSerializer = require('../serializers/environment');
const EnvironmentDeserializer = require('../deserializers/environment');

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
      .then(response => new EnvironmentDeserializer.deserialize(response.body));
  };

  this.createEnvironment = async (config) => {
    const authToken = authenticator.getAuthToken();
    let project;

    return agent
      .post(`${config.serverHost}/api/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
        project: { id: config.projectId }
      }))
      .then(response => new EnvironmentDeserializer.deserialize(response.body))
      .then(environment => environment);
  };

  this.deleteEnvironment = async (config) => {
    const authToken = authenticator.getAuthToken();
    let project;

    return agent
      .del(`${config.serverHost}/api/environments/${config.environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .then(() => true);
  };
}

module.exports = EnvironmentManager;
