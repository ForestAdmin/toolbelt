const authenticator = require('./../../src/services/authenticator');

module.exports = {
  mockToken: (behavior) => {
    if (behavior !== null) {
      authenticator.getAuthTokenBack = authenticator.getAuthToken;
      authenticator.getAuthToken = () => behavior;
    }
  },
  rollbackToken: (behavior) => {
    if (behavior !== null) {
      authenticator.getAuthToken = authenticator.getAuthTokenBack;
      authenticator.getAuthTokenBack = null;
    }
  },
};
