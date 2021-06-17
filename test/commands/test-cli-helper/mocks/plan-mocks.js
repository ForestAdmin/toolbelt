const abstractCommandPlanMock = {
  logger: {},
  chalk: {},
};

const makeAuthenticatorMock = (tokenBehavior) => ({
  getAuthToken: () => tokenBehavior,
  login: () => { },
  logout: () => { },
  tryLogin: () => { },
});

const abstractAuthenticatedPlanMock = makeAuthenticatorMock('valid-token');
const abstractNonAuthenticatedPlanMock = makeAuthenticatorMock(null);

module.exports = {
  abstractPlanMock: abstractCommandPlanMock,
  abstractAuthenticatedPlanMock,
  abstractNonAuthenticatedPlanMock,
  makeAuthenticatorMock,
  baseAuthenticatedPlanMock: [
    abstractCommandPlanMock,
    abstractAuthenticatedPlanMock,
  ],
};
