/* eslint-disable global-require */
module.exports = (plan) => plan
  .addUsingClass('errorHandler', () => require('../utils/error-handler'))
  .addUsingClass('schemaService', () => require('../services/schema/schema-service'));
