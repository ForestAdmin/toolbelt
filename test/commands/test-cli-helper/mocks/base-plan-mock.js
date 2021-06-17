const makeAuthenticatorMock = require('./make-authenticator-plan-mock');
const abstractCommandPlanMock = require('./abstract-command-plan-mock');

const abstractAuthenticatedCommandPlanMock = makeAuthenticatorMock('valid-token');

module.exports = [
  abstractCommandPlanMock,
  abstractAuthenticatedCommandPlanMock,
];
