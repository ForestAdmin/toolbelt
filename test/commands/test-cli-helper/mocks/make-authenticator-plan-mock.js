module.exports = (tokenBehavior) => (plan) => plan
  .addInstance('authenticator', {
    getAuthToken: () => tokenBehavior,
    login: () => { },
    logout: () => { },
    tryLogin: () => { },
  });
