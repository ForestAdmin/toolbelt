const _ = require('lodash');
const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const context = require('../context');
const ProjectSerializer = require('../serializers/project');
const ProjectDeserializer = require('../deserializers/project');
const EnvironmentDeserializer = require('../deserializers/environment');
const { serverHost } = require('../config');

const { authenticator } = context.inject();

function ProjectManager(config) {
  function deserialize(response) {
    const attrs = _.clone(ProjectSerializer.opts.attributes);
    attrs.push('id');

    return ProjectDeserializer
      .deserialize(response.body)
      .then((deserialized) => {
        if (_.isArray(deserialized)) {
          return deserialized.map((d) => _.pick(d, attrs));
        }

        return _.pick(deserialized, attrs);
      });
  }

  this.listProjects = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${serverHost()}/api/projects`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then((response) => deserialize(response));
  };

  this.getByEnvSecret = async (envSecret, includeLegacy = false) => {
    const authToken = authenticator.getAuthToken();
    const includeLegacyParameter = includeLegacy ? '&includeLegacy' : '';

    return agent
      .get(`${serverHost()}/api/projects?envSecret${includeLegacyParameter}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-secret-key', envSecret)
      .send()
      .then((response) => deserialize(response));
  };

  this.getProject = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${serverHost()}/api/projects/${config.projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then((response) => deserialize(response));
  };

  this.getProjectForDevWorkflow = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${serverHost()}/api/projects/${config.projectId}/dev-workflow`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then((response) => deserialize(response));
  };

  this.getDevelopmentEnvironmentForUser = async (projectId) => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${serverHost()}/api/projects/${projectId}/development-environment-for-user`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then((response) => EnvironmentDeserializer.deserialize(response.body));
  };
}

module.exports = ProjectManager;
