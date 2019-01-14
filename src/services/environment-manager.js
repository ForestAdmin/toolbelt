const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const authenticator = require('./authenticator');
const EnvironmentSerializer = require('../serializers/environment');
const EnvironmentDeserializer = require('../deserializers/environment');
const JobDeserializer = require('../deserializers/job');
const DeploymentRequestSerializer = require('../serializers/deployment-request');
const ProgressBar = require('progress');
const { promisify } = require('util');

const setTimeoutAsync = promisify(setTimeout);

function EnvironmentManager(config) {
  let bar;
  this.checkState = async (jobId, authToken) => {
    try {
      const jobResponse = await agent
        .get(`${config.serverHost}/api/jobs/${jobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('forest-origin', 'Lumber')
        .set('forest-project-id', config.projectId)
        .then(response => new JobDeserializer.deserialize(response.body));

      if (jobResponse
        && jobResponse.state) {
        let isBarComplete = false;
        if (jobResponse.progress) {
          bar.update(jobResponse.progress / 100);
          isBarComplete = bar.complete;
        }
        if (jobResponse.state !== 'inactive'
          && jobResponse.state !== 'active') {
          if (jobResponse.state === 'complete' && !isBarComplete) {
            bar.update(1);
          }
          return jobResponse.state !== 'failed';
        }
      }
    } catch (e) {
      return false;
    }

    await setTimeoutAsync(1000);
    return this.checkState(jobId, authToken);
  };

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
      .then(response => new EnvironmentDeserializer.deserialize(response.body));
  };

  this.deleteEnvironment = async (environmentId) => {
    const authToken = authenticator.getAuthToken();

    bar = new ProgressBar('Deleting environment [:bar] :percent', { total: 100 });
    bar.update(0);

    const deleteEnvironmentResponse = await agent
      .del(`${config.serverHost}/api/environments/${environmentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId);

    if (!deleteEnvironmentResponse.body
      || !deleteEnvironmentResponse.body.meta
      || !deleteEnvironmentResponse.body.meta.job_id) {
      return false;
    }

    const jobId = deleteEnvironmentResponse.body.meta.job_id;

    return this.checkState(jobId, authToken);
  };

  this.copyLayout = async (fromEnvironmentId, toEnvironmentId) => {
    const authToken = authenticator.getAuthToken();
    const deploymentRequest = {
      id: Math.random().toString(26).slice(2),
      type: 'environment',
      from: fromEnvironmentId,
      to: toEnvironmentId,
    };

    bar = new ProgressBar('Copying layout [:bar] :percent', { total: 100 });
    bar.update(0);

    const deploymentRequestResponse = await agent
      .post(`${config.serverHost}/api/deployment-requests`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-origin', 'Lumber')
      .set('forest-project-id', config.projectId)
      .send(DeploymentRequestSerializer.serialize(deploymentRequest));

    if (!deploymentRequestResponse
      || !deploymentRequestResponse.body
      || !deploymentRequestResponse.body.meta
      || !deploymentRequestResponse.body.meta.job_id) {
      return false;
    }

    const jobId = deploymentRequestResponse.body.meta.job_id;


    return this.checkState(jobId, authToken);
  };
}

module.exports = EnvironmentManager;
