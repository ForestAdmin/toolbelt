const P = require('bluebird');
const agent = require('superagent-promise')(require('superagent'), P);
const jwt = require('jsonwebtoken');
const authenticator = require('./authenticator');
const userDeserializer = require('../deserializers/user');
const { serverHost } = require('../config');

function UserManager(config) {
  this.getCurrentUser = async () => {
    const authToken = authenticator.getAuthToken();
    const decodedToken = jwt.decode(authToken);
    const currentUserId = decodedToken.data.data.id;

    return agent
      .get(`${serverHost()}/api/users/?id=${currentUserId}&projectId=${config.projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send()
      .then((response) => userDeserializer.deserialize(response.body));
  };
}

module.exports = UserManager;
