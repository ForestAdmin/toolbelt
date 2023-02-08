const abstractCommandPlanMock = plan => plan.addInstance('logger', {}).addInstance('chalk', {});

const makeAuthenticatorMock = tokenBehavior => ({
  getAuthToken: () => tokenBehavior,
  login: () => {},
  logout: () => {},
  tryLogin: () => {},
});

const abstractAuthenticatedPlanMock = plan =>
  plan.addInstance('authenticator', makeAuthenticatorMock('valid-token'));

module.exports = {
  makeAuthenticatorMock,
  baseAuthenticatedPlanMock: [abstractCommandPlanMock, abstractAuthenticatedPlanMock],
};
