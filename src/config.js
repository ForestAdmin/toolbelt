const authenticator = require('./services/authenticator');

module.exports = {
  authToken: authenticator.getAuthToken(),
  serverHost: process.env.SERVER_HOST ? process.env.SERVER_HOST : 'https://api.forestadmin.com',
}
