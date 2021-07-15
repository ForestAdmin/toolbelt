/* eslint-disable global-require */
module.exports = (plan) => plan
  .addStep('dependencies', (planDependencies) => planDependencies
    .addUsingClass('logger', () => require('../services/logger'))
    .addUsingClass('api', () => require('../services/api'))
    .addUsingClass('oidcAuthenticator', () => require('../services/oidc/authenticator'))
    .addUsingClass('applicationTokenService', () => require('../services/application-token')))
  .addStep('authenticator', (planAuthenticator) => planAuthenticator
    .addUsingClass('authenticator', () => require('../services/authenticator')));
