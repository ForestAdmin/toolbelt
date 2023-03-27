const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_CONTENT_TYPE_JSON = 'application/json';
const HEADER_FOREST_ORIGIN = 'forest-origin';
const HEADER_USER_AGENT = 'User-Agent';

/**
 * @class
 * @param {import('../context/plan').Context} context
 */
function Api({
  pkg,
  env,
  superagent: agent,
  applicationTokenSerializer,
  applicationTokenDeserializer,
  environmentDeserializer,
  environmentSerializer,
  projectDeserializer,
  projectSerializer,
}) {
  this.endpoint = () => env.FOREST_SERVER_URL;
  this.userAgent = `forest-cli@${pkg.version}`;
  const headers = {
    [HEADER_FOREST_ORIGIN]: 'forest-cli',
    [HEADER_CONTENT_TYPE]: HEADER_CONTENT_TYPE_JSON,
    [HEADER_USER_AGENT]: this.userAgent,
  };

  this.login = async (email, password) =>
    agent
      .post(`${this.endpoint()}/api/sessions`)
      .set(headers)
      .send({ email, password })
      .then(response => response.body.token);

  /**
   * @param {import('../serializers/application-token').InputApplicationToken} applicationToken
   * @param {string} sessionToken
   * @returns {Promise<import('../deserializers/application-token').ApplicationToken>}
   */
  this.createApplicationToken = async (applicationToken, sessionToken) =>
    agent
      .post(`${this.endpoint()}/api/application-tokens`)
      .set(headers)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send(applicationTokenSerializer.serialize(applicationToken))
      .then(response => applicationTokenDeserializer.deserialize(response.body));

  /**
   * @param {string} sessionToken
   * @returns {Promise<import('../deserializers/application-token').ApplicationToken>}
   */
  this.deleteApplicationToken = async sessionToken =>
    agent
      .delete(`${this.endpoint()}/api/application-tokens`)
      .set(HEADER_FOREST_ORIGIN, 'forest-cli')
      .set(HEADER_CONTENT_TYPE, HEADER_CONTENT_TYPE_JSON)
      .set(HEADER_USER_AGENT, this.userAgent)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send();

  this.createProject = async (config, sessionToken, project) => {
    let newProject;

    try {
      newProject = await agent
        .post(`${this.endpoint()}/api/projects`)
        .set(HEADER_CONTENT_TYPE, HEADER_CONTENT_TYPE_JSON)
        .set(HEADER_USER_AGENT, this.userAgent)
        .set('Authorization', `Bearer ${sessionToken}`)
        .send(projectSerializer.serialize(project))
        .then(response => projectDeserializer.deserialize(response.body));
    } catch (error) {
      if (error.message === 'Conflict') {
        const { projectId } = error.response.body.errors[0].meta;

        if (!projectId) {
          throw error;
        }

        newProject = await agent
          .get(`${this.endpoint()}/api/projects/${projectId}`)
          .set('Authorization', `Bearer ${sessionToken}`)
          .set(HEADER_USER_AGENT, this.userAgent)
          .send()
          .then(response => projectDeserializer.deserialize(response.body));

        // NOTICE: Avoid to erase an existing project that has been already initialized.
        if (newProject.initializedAt) {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const hostname = config.appHostname || 'http://localhost';
    const port = config.appPort || 3310;
    const protocol = hostname.startsWith('http') ? '' : 'http://';
    newProject.defaultEnvironment.apiEndpoint = `${protocol}${hostname}:${port}`;
    const updatedEnvironment = await agent
      .put(`${this.endpoint()}/api/environments/${newProject.defaultEnvironment.id}`)
      .set(HEADER_CONTENT_TYPE, HEADER_CONTENT_TYPE_JSON)
      .set(HEADER_USER_AGENT, this.userAgent)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send(environmentSerializer.serialize(newProject.defaultEnvironment))
      .then(response => environmentDeserializer.deserialize(response.body));

    newProject.defaultEnvironment.secretKey = updatedEnvironment.secretKey;

    return newProject;
  };
}

module.exports = Api;
