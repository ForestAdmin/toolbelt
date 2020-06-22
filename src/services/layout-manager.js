const agent = require('superagent');
const authenticator = require('./authenticator');
const { serverHost } = require('../config');

/**
 * Deploy layout changes of an environment to production.
 * @param {Number} environment.id - The environment id that contains the layout changes to deploy.
 * @param {String} environmentSecret - The current environment secret.
 */
function deploy({ id }, environmentSecret) {
  const authToken = authenticator.getAuthToken();

  return agent
    .post(`${serverHost()}/api/environments/deploy`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send({ environmentId: id });
}

module.exports = {
  deploy,
};
