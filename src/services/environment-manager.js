const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const EnvironmentSerializer = require('../serializers/environment');
const environmentDeserializer = require('../deserializers/environment');
const DeploymentRequestSerializer = require('../serializers/deployment-request');
const JobStateChecker = require('../services/job-state-checker');

function EnvironmentManager(config) {
  this.listEnvironments = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${config.serverHost}/api/projects/${config.projectId}/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send()
      .then(response => environmentDeserializer.deserialize(response.body));
  };

  this.getEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${config.serverHost}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send()
      .then(response => environmentDeserializer.deserialize(response.body));
  };

  this.createEnvironment = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${config.serverHost}/api/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
        project: { id: config.projectId },
      }))
      .then(response => environmentDeserializer.deserialize(response.body));
  };

  this.deleteEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();
    const jobStateChecker = new JobStateChecker('Deleting environment');

    const deleteEnvironmentResponse = await agent
      .del(`${config.serverHost}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId);

    if (!deleteEnvironmentResponse.body
      || !deleteEnvironmentResponse.body.meta
      || !deleteEnvironmentResponse.body.meta.job_id) {
      return false;
    }

    const jobId = deleteEnvironmentResponse.body.meta.job_id;

    return jobStateChecker.check(jobId, config.projectId);
  };

  this.copyLayout = async (fromEnvironmentId, toEnvironmentId) => {
    const authToken = authenticator.getAuthToken();
    const deploymentRequest = {
      id: Math.random().toString(26).slice(2),
      type: 'environment',
      from: fromEnvironmentId,
      to: toEnvironmentId,
    };

    const jobStateChecker = new JobStateChecker('Copying layout');

    const deploymentRequestResponse = await agent
      .post(`${config.serverHost}/api/deployment-requests`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send(DeploymentRequestSerializer.serialize(deploymentRequest));

    if (!deploymentRequestResponse
      || !deploymentRequestResponse.body
      || !deploymentRequestResponse.body.meta
      || !deploymentRequestResponse.body.meta.job_id) {
      return false;
    }

    const jobId = deploymentRequestResponse.body.meta.job_id;


    return jobStateChecker.check(jobId, config.projectId);
  };
}

module.exports = EnvironmentManager;
