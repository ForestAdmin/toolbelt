const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const Context = require('@forestadmin/context');

const EnvironmentSerializer = require('../serializers/environment');
const environmentDeserializer = require('../deserializers/environment');
const DeploymentRequestSerializer = require('../serializers/deployment-request');
const JobStateChecker = require('./job-state-checker');

function EnvironmentManager(config) {
  const {
    assertPresent, authenticator, env, keyGenerator,
  } = Context.inject();
  assertPresent({ authenticator, env, keyGenerator });

  this.listEnvironments = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${env.FOREST_URL}/api/projects/${config.projectId}/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send()
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.getEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${env.FOREST_URL}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-environment-id', environmentId)
      .send()
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.getEnvironmentApimap = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .get(`${env.FOREST_URL}/api/apimaps/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-environment-id', environmentId)
      .send();
    return response.body.apimap;
  };

  this.createEnvironment = async () => {
    const authToken = authenticator.getAuthToken();

    const response = await agent
      .post(`${env.FOREST_URL}/api/environments`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-project-id', config.projectId)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
        project: { id: config.projectId },
      }));
    const environment = await environmentDeserializer.deserialize(response.body);

    environment.authSecret = keyGenerator.generate();
    return environment;
  };

  this.createDevelopmentEnvironment = async (projectId, endpoint) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${env.FOREST_URL}/api/projects/${projectId}/development-environment-for-user`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ endpoint })
      .then((response) => environmentDeserializer.deserialize(response.body));
  };

  this.updateEnvironment = async () => {
    const authToken = authenticator.getAuthToken();
    return agent
      .put(`${env.FOREST_URL}/api/environments/${config.environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(EnvironmentSerializer.serialize({
        name: config.name,
        apiEndpoint: config.url,
      }));
  };

  this.deleteEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .del(`${env.FOREST_URL}/api/environments/${environmentId}`)
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
      .post(`${env.FOREST_URL}/api/deployment-requests`)
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

  this.reset = async (environmentName, environmentSecret) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${env.FOREST_URL}/api/environments/reset`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-secret-key', `${environmentSecret}`)
      .send({ environmentName });
  };

  /**
   * Deploy layout changes of an environment to production.
   * @param {Number} environment.id - The environment id that contains the layout changes to deploy.
   */
  this.deploy = () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .post(`${env.FOREST_URL}/api/environments/deploy`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-secret-key', `${config.envSecret}`);
  };
}

module.exports = EnvironmentManager;
