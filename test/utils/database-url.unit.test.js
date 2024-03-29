const { default: buildDatabaseUrl, isDatabaseLocal } = require('../../src/utils/database-url');

describe('utils > buildDatabaseUrl', () => {
  describe('buildDatabaseUrl', () => {
    describe('when missing configuration', () => {
      it('should return null', () => {
        expect.assertions(1);

        expect(buildDatabaseUrl(null)).toBeNull();
      });
    });

    describe('with a configuration', () => {
      describe('without a username nor a password', () => {
        it('should return the database URL without an `@', () => {
          expect.assertions(1);

          const config = {
            dbDialect: 'mongodb',
            dbHostname: 'localhost',
            dbName: 'forest',
            dbPort: 4242,
          };
          const databaseUrl = buildDatabaseUrl(config);

          expect(databaseUrl).toBe('mongodb://localhost:4242/forest');
        });
      });

      describe('providing a dbConnectionUrl', () => {
        it('should return it', () => {
          expect.assertions(1);

          const config = {
            dbConnectionUrl: Symbol('dbConnectionUrl'),
          };
          const databaseUrl = buildDatabaseUrl(config);

          expect(databaseUrl).toBe(config.dbConnectionUrl);
        });
      });

      describe('missing a dbConnectionUrl', () => {
        it('should build the URL from the configuration', () => {
          expect.assertions(1);

          const config = {
            dbDialect: '__protocol__',
            dbHostname: '__dbHostname__',
            dbName: '__dbName__',
            dbPassword: '__dbPassword__',
            dbPort: '__dbPort__',
            dbUser: '__dbUser__',
          };
          const databaseUrl = buildDatabaseUrl(config);

          expect(databaseUrl).toBe(
            '__protocol__://__dbUser__:__dbPassword__@__dbHostname__:__dbPort__/__dbName__',
          );
        });

        describe('when given the MongoDB SRV option', () => {
          it('should include it when dialect is "mongodb" and ignore port', () => {
            expect.assertions(1);

            const config = {
              dbDialect: 'mongodb',
              dbHostname: '__dbHostname__',
              dbName: '__dbName__',
              dbPassword: '__dbPassword__',
              dbPort: '__dbPort__',
              dbUser: '__dbUser__',
              mongodbSrv: true,
            };
            const databaseUrl = buildDatabaseUrl(config);

            expect(databaseUrl).toBe(
              'mongodb+srv://__dbUser__:__dbPassword__@__dbHostname__/__dbName__',
            );
          });

          it('should ignore it otherwise', () => {
            expect.assertions(1);

            const config = {
              dbDialect: '__protocol__',
              dbHostname: '__dbHostname__',
              dbName: '__dbName__',
              dbPassword: '__dbPassword__',
              dbPort: '__dbPort__',
              dbUser: '__dbUser__',
              mongodbSrv: true,
            };
            const databaseUrl = buildDatabaseUrl(config);

            expect(databaseUrl).toBe(
              '__protocol__://__dbUser__:__dbPassword__@__dbHostname__:__dbPort__/__dbName__',
            );
          });
        });
      });
    });
  });

  describe('isDatabaseLocal', () => {
    it('should return true for a config referring to a database hosted locally', () => {
      expect.assertions(1);

      const dbConnectionUrl = 'mongodb+srv://root:password@localhost/forest';

      expect(isDatabaseLocal({ dbConnectionUrl })).toBe(true);
    });

    it('should return false for a config referring to a database not hosted locally', () => {
      expect.assertions(1);

      const dbConnectionUrl = 'mongodb+srv://root:password@somewhere.intheworld.com/forest';

      expect(isDatabaseLocal({ dbConnectionUrl })).toBe(false);
    });
  });
});
