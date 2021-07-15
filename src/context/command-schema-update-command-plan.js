const ErrorHandler = require('../utils/error-handler');
const SchemaService = require('../services/schema/schema-service');

module.exports = (plan) => plan
  .addClass(ErrorHandler)
  .addClass(SchemaService);
