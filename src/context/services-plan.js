const Logger = require('../services/logger');
const Authenticator = require('../services/authenticator');
const OidcAuthenticator = require('../services/oidc/authenticator');
const ApplicationTokenService = require('../services/application-token');
const Api = require('../services/api');

module.exports = (plan) => plan
  .addStep('dependencies', (planDependencies) => planDependencies
    .addClass(Logger)
    .addClass(Api)
    .addClass(OidcAuthenticator)
    .addClass(ApplicationTokenService))
  .addStep('authenticator', (planAuthenticator) => planAuthenticator
    .addClass(Authenticator));
