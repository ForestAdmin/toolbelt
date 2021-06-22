const DatabaseAnalyzer = require('../services/schema/update/analyzer/database-analyzer');
const mongoAnalyzer = require('../services/schema/update/analyzer/mongo-collections-analyzer');
const sequelizeAnalyzer = require('../services/schema/update/analyzer/sequelize-tables-analyzer');

module.exports = (plan) => plan
  .addFunction('mongoAnalyzer', mongoAnalyzer)
  .addFunction('sequelizeAnalyzer', sequelizeAnalyzer)
  .addClass(DatabaseAnalyzer);
