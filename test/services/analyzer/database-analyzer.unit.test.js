const DatabaseAnalyzer = require('../../../src/services/schema/update/analyzer/database-analyzer');

const setupConstructorTest = () => ({
  assertPresent: jest.fn(),
  terminator: Symbol('terminator'),
  mongoAnalyzer: {
    analyzeMongoCollections: jest.fn(),
  },
  sequelizeAnalyzer: Symbol('sequelizeAnalyzer'),
});

describe('unit > DatabaseAnalyzer', () => {
  it('should assert dependencies', () => {
    expect.assertions(4);

    const context = setupConstructorTest();
    const databaseAnalyzer = new DatabaseAnalyzer(context);

    const {
      assertPresent, terminator, mongoAnalyzer, sequelizeAnalyzer,
    } = context;

    expect(assertPresent).toHaveBeenCalledWith({
      terminator, mongoAnalyzer, sequelizeAnalyzer,
    });
    expect(databaseAnalyzer.terminator).toBe(terminator);
    expect(databaseAnalyzer.mongoAnalyzer).toBe(mongoAnalyzer);
    expect(databaseAnalyzer.sequelizeAnalyzer).toBe(sequelizeAnalyzer);
  });

  describe('analyzeMongoDb', () => {
    it('should call correctly the analysis for the mongo collections', async () => {
      expect.assertions(2);

      const context = setupConstructorTest();
      const { mongoAnalyzer } = context;

      const analyze = Symbol('analyze');
      const bind = jest.fn().mockReturnValue(analyze);
      mongoAnalyzer.analyzeMongoCollections = { bind };

      const databaseAnalyzer = new DatabaseAnalyzer(context);

      jest.spyOn(databaseAnalyzer, '_analyze').mockImplementation();

      const dbInstance = Symbol('instance');
      const db = jest.fn().mockReturnValue(dbInstance);
      const databaseConnection = { db };
      const config = Symbol('config');
      const allowWarning = true;

      await databaseAnalyzer.analyzeMongoDb(databaseConnection, config, allowWarning);

      expect(bind).toHaveBeenCalledWith(mongoAnalyzer);
      expect(databaseAnalyzer._analyze).toHaveBeenCalledWith(
        analyze, dbInstance, config, allowWarning,
      );
    });
  });
});
