const querystring = require('querystring');
const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const Context = require('@forestadmin/context');

const ProjectSerializer = require('../serializers/project');
const ProjectDeserializer = require('../deserializers/project');
const EnvironmentDeserializer = require('../deserializers/environment');

function ProjectManager(config) {
  const { assertPresent, authenticator, env, jwtDecode, lodash } = Context.inject();
  assertPresent({ authenticator, env, jwtDecode, lodash });

  function deserialize(response) {
    const attrs = Object.assign(ProjectSerializer.opts.attributes);
    attrs.push('id');

    return ProjectDeserializer.deserialize(response.body).then(deserialized => {
      if (Array.isArray(deserialized)) {
        return deserialized.map(d => lodash.pick(d, attrs));
      }

      return lodash.pick(deserialized, attrs);
    });
  }

  this.listProjects = async () => {
    const authToken = authenticator.getAuthToken();
    const authTokenDecode = jwtDecode(authToken);
    const queryParams = querystring.stringify({
      ...(authTokenDecode.organizationId ? { organizationId: authTokenDecode.organizationId } : {}),
    });

    return agent
      .get(`${env.FOREST_SERVER_URL}/api/projects${queryParams ? `?${queryParams}` : ''}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then(response => deserialize(response));
  };

  this.getByEnvSecret = async (envSecret, includeLegacy = false) => {
    const authToken = authenticator.getAuthToken();
    const includeLegacyParameter = includeLegacy ? '&includeLegacy' : '';

    return agent
      .get(`${env.FOREST_SERVER_URL}/api/projects?envSecret${includeLegacyParameter}`)
      .set('Authorization', `Bearer ${authToken}`)
      .set('forest-secret-key', envSecret)
      .send()
      .then(response => deserialize(response));
  };

  this.getProject = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${env.FOREST_SERVER_URL}/api/projects/${config.projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then(response => deserialize(response));
  };

  this.getProjectForDevWorkflow = async () => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${env.FOREST_SERVER_URL}/api/projects/${config.projectId}/dev-workflow`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then(response => deserialize(response));
  };

  this.getDevelopmentEnvironmentForUser = async projectId => {
    const authToken = authenticator.getAuthToken();

    return agent
      .get(`${env.FOREST_SERVER_URL}/api/projects/${projectId}/development-environment-for-user`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then(response => EnvironmentDeserializer.deserialize(response.body));
  };
}

module.exports = ProjectManager;
