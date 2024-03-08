/* eslint-disable global-require */
module.exports = plan =>
  plan
    .addPackage('dependencies', planDependencies =>
      planDependencies
        .addUsingClass('api', () => require('../services/api'))
        .addUsingClass('oidcAuthenticator', () => require('../services/oidc/authenticator').default)
        .addUsingClass('applicationTokenService', () => require('../services/application-token')),
    )
    .addPackage('authenticator', planAuthenticator =>
      planAuthenticator.addUsingClass('authenticator', () => require('../services/authenticator')),
    );
