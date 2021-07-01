const ForestCLIError = require('../../src/errors/forest-cli-error');
const EmptyDatabaseError = require('../../src/errors/database/empty-database-error');

describe('utils > errors', () => {
  describe('forestCLIError', () => {
    it('should be an instance of Error', () => {
      expect.assertions(1);

      const error = new ForestCLIError();

      expect(error).toBeInstanceOf(Error);
    });

    it('should handle the details of an error', () => {
      expect.assertions(1);

      const error = new ForestCLIError('an error', 'a detail');

      expect(error.details).toStrictEqual('a detail');
    });
  });

  describe('databaseAnalyzerErrors', () => {
    it('emptyDatabase should be of type ForestCLIError', () => {
      expect.assertions(1);

      const error = new EmptyDatabaseError();

      expect(error).toBeInstanceOf(ForestCLIError);
    });
  });
});
