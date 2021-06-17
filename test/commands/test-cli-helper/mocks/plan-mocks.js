const abstractPlanMock = (plan) => plan
  .addInstance('logger', {})
  .addInstance('chalk', {});

const makeAuthenticatorPlanMock = (tokenBehavior) => (plan) => plan
  .addInstance('authenticator', {
    getAuthToken: () => tokenBehavior,
    login: () => { },
    logout: () => { },
    tryLogin: () => { },
  });

const abstractAuthenticatedPlanMock = makeAuthenticatorPlanMock('valid-token');
const abstractNonAuthenticatedPlanMock = makeAuthenticatorPlanMock(null);

module.exports = {
  abstractPlanMock,
  abstractAuthenticatedPlanMock,
  abstractNonAuthenticatedPlanMock,
  makeAuthenticatorPlanMock,
  baseAuthenticatedPlanMock: [
    abstractPlanMock,
    abstractAuthenticatedPlanMock,
  ],
};
