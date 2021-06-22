const path = require('path');
const ErrorHandler = require('../utils/error-handler');
const SchemaService = require('../services/schema/schema-service');

module.exports = (plan) => plan
  .addInstance('path', path)
  .addClass(ErrorHandler)
  .addClass(SchemaService);
