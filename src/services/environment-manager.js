const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const context = require('@forestadmin/context');
const EnvironmentSerializer = require('../serializers/environment');
const environmentDeserializer = require('../deserializers/environment');
const DeploymentRequestSerializer = require('../serializers/deployment-request');
const JobStateChecker = require('../services/job-state-checker');
const { serverHost } = require('../config');

function EnvironmentManager(config) {
  const { assertPresent, authenticator } = context.inject();
  assertPresent({ authenticator });

  this.listEnvironments = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${serverHost()}/api/projects/${config.projectId}/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send()
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.getEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${serverHost()}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-environment-id', environmentId)
      .send()
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.createEnvironment = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${serverHost()}/api/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
        project: { id: config.projectId },
      }))
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.createDevelopmentEnvironment = async (projectId, endpoint) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${serverHost()}/api/projects/${projectId}/development-environment-for-user`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ endpoint })
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.updateEnvironment = async () => {
    const authToken = authenticator.getAuthToken();
    return agent
      .put(`${serverHost()}/api/environments/${config.environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
      }));
  };

  this.deleteEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .del(`${serverHost()}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-environment-id', environmentId);
  };

  this.copyLayout = async (fromEnvironmentId, toEnvironmentId, oclifExit) => {
    const authToken = authenticator.getAuthToken();
    const deploymentRequest = {
      id: Math.random().toString(26).slice(2),
      type: 'environment',
      from: fromEnvironmentId,
      to: toEnvironmentId,
    };

    const jobStateChecker = new JobStateChecker('Copying layout', oclifExit);

    const deploymentRequestResponse = await agent
      .post(`${serverHost()}/api/deployment-requests`)
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

  /**
   * Deploy layout changes of an environment to production.
   * @param {Number} environment.id - The environment id that contains the layout changes to deploy.
   */
  this.deploy = ({ id }) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${serverHost()}/api/environments/deploy`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-secret-key', `${config.envSecret}`)
      .set('forest-environment-id', `${id}`)
      .send({ environmentId: id });
  };
}

module.exports = EnvironmentManager;
