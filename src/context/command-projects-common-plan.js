/* eslint-disable global-require */
module.exports = (plan) => plan
  .addModule('path', () => require('path'))
  .addUsingFunction('mongoAnalyzer', () => require('../services/schema/update/analyzer/mongo-collections-analyzer'))
  .addUsingFunction('sequelizeAnalyzer', () => require('../services/schema/update/analyzer/sequelize-tables-analyzer'))
  .addUsingClass('databaseAnalyzer', () => require('../services/schema/update/analyzer/database-analyzer'));
