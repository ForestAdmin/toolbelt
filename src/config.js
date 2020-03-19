require('dotenv').config();
const authenticator = require('./services/authenticator');

module.exports = {
  authToken: () => authenticator.getAuthToken(),
  serverHost: () => process.env.FOREST_URL || 'https://api.forestadmin.com',
};
