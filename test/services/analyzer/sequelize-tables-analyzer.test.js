const Context = require('@forestadmin/context');
const analyzeSequelizeTables = require('../../../src/services/schema/update/analyzer/sequelize-tables-analyzer');
const EmptyDatabaseError = require('../../../src/errors/database/empty-database-error');

const defaultPlan = require('../../../src/context/plan');

describe('services > sequelizeTablesAnalyzer', () => {
  describe('analyzeSequelizeTables', () => {
    it("should return an EmptyDatabase error if connection doesn't have tables", async () => {
      expect.assertions(1);

      Context.init(defaultPlan);

      const databaseConnectionMock = {
        QueryTypes: {},
        query: jest.fn().mockReturnValue([]),
        getQueryInterface: jest.fn().mockReturnValue({
          showAllTables: jest.fn().mockResolvedValue([]),
        }),
        getDialect: jest.fn().mockReturnValue('mysql'),
      };

      const error = new EmptyDatabaseError('no tables found');

      await expect(analyzeSequelizeTables(databaseConnectionMock, {})).rejects.toThrow(error);
    });
  });
});
