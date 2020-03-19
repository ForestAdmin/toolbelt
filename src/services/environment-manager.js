const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const EnvironmentSerializer = require('../serializers/environment');
const environmentDeserializer = require('../deserializers/environment');
const DeploymentRequestSerializer = require('../serializers/deployment-request');
const JobStateChecker = require('../services/job-state-checker');

function EnvironmentManager(config) {
  this.endpoint = () => process.env.FOREST_URL || 'https://api.forestadmin.com';

  this.listEnvironments = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${this.endpoint()}/api/projects/${config.projectId}/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send()
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.getEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${this.endpoint()}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-environment-id', environmentId)
      .send()
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.createEnvironment = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${this.endpoint()}/api/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
        project: { id: config.projectId },
      }))
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.updateEnvironment = async () => {
    const authToken = authenticator.getAuthToken();
    return agent
      .put(`${this.endpoint()}/api/environments/${config.environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
      }));
  };

  this.deleteEnvironment = async (environmentId, logError) => {
    const authToken = authenticator.getAuthToken();
    const jobStateChecker = new JobStateChecker('Deleting environment', logError);

    const deleteEnvironmentResponse = await agent
      .del(`${this.endpoint()}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-environment-id', environmentId);

    if (!deleteEnvironmentResponse.body
      || !deleteEnvironmentResponse.body.meta
      || !deleteEnvironmentResponse.body.meta.job_id) {
      return false;
    }

    const jobId = deleteEnvironmentResponse.body.meta.job_id;

    return jobStateChecker.check(jobId, config.projectId);
  };

  this.copyLayout = async (fromEnvironmentId, toEnvironmentId, logError) => {
    const authToken = authenticator.getAuthToken();
    const deploymentRequest = {
      id: Math.random().toString(26).slice(2),
      type: 'environment',
      from: fromEnvironmentId,
      to: toEnvironmentId,
    };

    const jobStateChecker = new JobStateChecker('Copying layout', logError);

    const deploymentRequestResponse = await agent
      .post(`${this.endpoint()}/api/deployment-requests`)
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
