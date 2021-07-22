const EmptyDatabaseError = require('../../../../errors/database/empty-database-error');

module.exports = class DatabaseAnalyzer {
  constructor({
    assertPresent,
    mongoAnalyzer,
    sequelizeAnalyzer,
    terminator,
  }) {
    assertPresent({
      mongoAnalyzer,
      sequelizeAnalyzer,
      terminator,
    });
    this.mongoAnalyzer = mongoAnalyzer;
    this.sequelizeAnalyzer = sequelizeAnalyzer;
    this.terminator = terminator;
  }

  async reportEmptyDatabase(orm, dialect) {
    const logs = [`Your database looks empty! Please create some ${orm === 'mongoose' ? 'collections' : 'tables'} before running the command.`];
    if (orm === 'sequelize') {
      logs.push('If not, check whether you are using a custom database schema (use in that case the --schema option).');
    }
    return this.terminator.terminate(1, {
      logs,
      errorCode: 'database_empty',
      errorMessage: 'Your database is empty.',
      context: {
        orm,
        dialect,
      },
    });
  }

  async analyze(databaseConnection, config, allowWarning) {
    let analyze;
    if (config.dbDialect === 'mongodb') {
      analyze = this.mongoAnalyzer;
      databaseConnection = databaseConnection.db();
    } else {
      analyze = this.sequelizeAnalyzer;
    }
    return analyze(databaseConnection, config, allowWarning)
      .catch((error) => {
        if (error instanceof EmptyDatabaseError) {
          return this.reportEmptyDatabase(error.details.orm, error.details.dialect);
        }
        throw error;
      });
  }
};
