const DatabaseAnalyzer = require('../../../src/services/schema/update/analyzer/database-analyzer');

const setupConstructorTest = () => ({
  assertPresent: jest.fn(),
  terminator: Symbol('terminator'),
  mongoAnalyzer: Symbol('mongoAnalyzer'),
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
});
