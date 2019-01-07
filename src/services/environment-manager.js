const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const EnvironmentSerializer = require('../serializers/environment');
const EnvironmentDeserializer = require('../deserializers/environment');
const DeploymentRequestSerializer = require('../serializers/deployment-request');

function EnvironmentManager(config) {
  this.listEnvironments = async () => {
    const authToken = authenticator.getAuthToken();

    /* eslint new-cap: off */
    return agent
      .get(`${config.serverHost}/api/projects/${config.projectId}/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send()
      .then(response => new EnvironmentDeserializer.deserialize(response.body));
  };

  this.getEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${config.serverHost}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send()
      .then(response => new EnvironmentDeserializer.deserialize(response.body));
  };

  this.createEnvironment = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${config.serverHost}/api/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
        project: { id: config.projectId },
      }))
      .then(response => new EnvironmentDeserializer.deserialize(response.body))
      .then(environment => environment);
  };

  this.deleteEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .del(`${config.serverHost}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .then(() => true);
  };

  this.copyLayout = async (fromEnvironmentId, toEnvironmentId) => {
    console.log('fromEnvironmentId: ', fromEnvironmentId);
    console.log('toEnvironmentId: ', toEnvironmentId);
    const authToken = authenticator.getAuthToken();
    const deploymentRequest = {
      id: Math.random().toString(26).slice(2),
      from: { id: fromEnvironmentId },
      to: { id: toEnvironmentId },
    };

    console.log('DeploymentRequestSerializer.serialize(deploymentRequest):', JSON.stringify(DeploymentRequestSerializer.serialize(deploymentRequest), null, 2));

    return agent
      .post(`${config.serverHost}/api/deployment-requests`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send(DeploymentRequestSerializer.serialize(deploymentRequest))
      .then(() => true);
  };
}

module.exports = EnvironmentManager;
