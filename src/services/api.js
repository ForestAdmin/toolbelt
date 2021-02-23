const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_CONTENT_TYPE_JSON = 'application/json';
const HEADER_FOREST_ORIGIN = 'forest-origin';
const HEADER_USER_AGENT = 'User-Agent';

/**
 * @class
 * @param {import('../context/init').Context} context
 */
function Api({
  pkg, env, superagent: agent, applicationTokenSerializer, applicationTokenDeserializer,
}) {
  this.endpoint = () => env.FOREST_URL || 'https://api.forestadmin.com';
  this.userAgent = `forest-cli@${pkg.version}`;
  const headers = {
    [HEADER_FOREST_ORIGIN]: 'forest-cli',
    [HEADER_CONTENT_TYPE]: HEADER_CONTENT_TYPE_JSON,
    [HEADER_USER_AGENT]: this.userAgent,
  };

  this.login = async (email, password) => agent
    .post(`${this.endpoint()}/api/sessions`)
    .set(headers)
    .send({ email, password })
    .then((response) => response.body.token);

  /**
   * @param {import('../serializers/application-token').InputApplicationToken} applicationToken
   * @param {string} sessionToken
   * @returns {Promise<import('../deserializers/application-token').ApplicationToken>}
   */
  this.createApplicationToken = async (applicationToken, sessionToken) => agent
    .post(`${this.endpoint()}/api/application-tokens`)
    .set(headers)
    .set('Authorization', `Bearer ${sessionToken}`)
    .send(applicationTokenSerializer.serialize(applicationToken))
    .then((response) => applicationTokenDeserializer.deserialize(response.body));


  /**
   * @param {string} sessionToken
   * @returns {Promise<import('../deserializers/application-token').ApplicationToken>}
   */
  this.deleteApplicationToken = async (sessionToken) => agent
    .delete(`${this.endpoint()}/api/application-tokens`)
    .set(HEADER_FOREST_ORIGIN, 'forest-cli')
    .set(HEADER_CONTENT_TYPE, HEADER_CONTENT_TYPE_JSON)
    .set(HEADER_USER_AGENT, this.userAgent)
    .set('Authorization', `Bearer ${sessionToken}`)
    .send();
}

module.exports = Api;
