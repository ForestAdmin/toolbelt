/* eslint-disable global-require */
module.exports = (plan) => plan
  .addModule('path', () => require('path'))
  .addFunction('mongoAnalyzer', require('../services/schema/update/analyzer/mongo-collections-analyzer'))
  .addFunction('sequelizeAnalyzer', require('../services/schema/update/analyzer/sequelize-tables-analyzer'))
  .addUsingClass('databaseAnalyzer', () => require('../services/schema/update/analyzer/database-analyzer'));
