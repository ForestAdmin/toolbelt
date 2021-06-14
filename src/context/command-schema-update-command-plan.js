const path = require('path');
const DatabaseAnalyzer = require('../services/schema/update/analyzer/database-analyzer');
const ErrorHandler = require('../utils/error-handler');
const mongoAnalyzer = require('../services/schema/update/analyzer/mongo-collections-analyzer');
const sequelizeAnalyzer = require('../services/schema/update/analyzer/sequelize-tables-analyzer');
const SchemaService = require('../services/schema/schema-service');

module.exports = (plan) => plan
  .addInstance('path', path)
  .addClass(ErrorHandler)
  .addFunction('mongoAnalyzer', mongoAnalyzer)
  .addFunction('sequelizeAnalyzer', sequelizeAnalyzer)
  .addClass(DatabaseAnalyzer)
  .addClass(SchemaService);
