const agent = require('superagent');
const authenticator = require('./authenticator');
const { serverHost } = require('../config');

function deploy({ id }, environmentSecret) {
  const authToken = authenticator.getAuthToken();

  return agent
    .post(`${serverHost()}/api/layout/deploy`)
    .set('Authorization', `Bearer ${authToken}`)
    .set('forest-secret-key', `${environmentSecret}`)
    .send({ environmentId: id });
}

module.exports = {
  deploy,
};
