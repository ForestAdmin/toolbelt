import * as options from '../../../../src/services/projects/create/options';

describe('projectCreateOptions', () => {
  describe('databasePort', () => {
    it.each([
      ['5432', 'postgres'],
      ['3306', 'mysql'],
      ['3306', 'mariadb'],
      ['1433', 'mssql'],
      ['27017', 'mongodb'],
      [undefined, 'invalid'],
    ])('default should return %s when databaseDialect is %s', (port, dialect) => {
      expect.assertions(1);

      const fn = options.databasePort.default as (args: Record<string, unknown>) => string;
      expect(fn({ databaseDialect: dialect })).toBe(port);
    });
  });

  describe('databaseUser', () => {
    it('default should return undefined when databaseDialect is mongodb', () => {
      expect.assertions(1);

      const fn = options.databaseUser.default as (args: Record<string, unknown>) => string;
      expect(fn({ databaseDialect: 'mongodb' })).toBeUndefined();
    });

    it('default should return root otherwise', () => {
      expect.assertions(1);

      const fn = options.databaseUser.default as (args: Record<string, unknown>) => string;
      expect(fn({ databaseDialect: 'postgres' })).toBe('root');
    });
  });

  describe('databaseSchema', () => {
    it('default should return public when databaseDialect is postgres', () => {
      expect.assertions(1);

      const fn = options.databaseSchema.default as (args: Record<string, unknown>) => string;
      expect(fn({ databaseDialect: 'postgres' })).toBe('public');
    });

    it('default should return an empty string otherwise', () => {
      expect.assertions(1);

      const fn = options.databaseSchema.default as (args: Record<string, unknown>) => string;
      expect(fn({ databaseDialect: 'mysql' })).toBe('');
    });

    it('when should return true when databaseDialect is postgres', () => {
      expect.assertions(1);

      const fn = options.databaseSchema.when as (args: Record<string, unknown>) => boolean;
      expect(fn({ databaseDialect: 'postgres' })).toBe(true);
    });

    it('when should return false when databaseDialect is mysql', () => {
      expect.assertions(1);

      const fn = options.databaseSchema.when as (args: Record<string, unknown>) => boolean;
      expect(fn({ databaseDialect: 'mysql' })).toBe(false);
    });
  });

  describe('mongoDBSRV', () => {
    it('when should return true when databaseDialect is mongodb', () => {
      expect.assertions(1);

      const fn = options.mongoDBSRV.when as (args: Record<string, unknown>) => boolean;
      expect(fn({ databaseDialect: 'mongodb' })).toBe(true);
    });
  });

  // Connection-URL onboarding helpers (used by sql/nosql to offer "paste a URL" interactively).
  describe('connection URL helpers', () => {
    it('skipWhenConnectionUrl: true without a URL (or a blank one), false with one', () => {
      expect.assertions(3);
      expect(options.skipWhenConnectionUrl({})).toBe(true);
      // A blank answer to the URL prompt means "fill the fields instead".
      expect(options.skipWhenConnectionUrl({ databaseConnectionURL: '' })).toBe(true);
      expect(options.skipWhenConnectionUrl({ databaseConnectionURL: 'postgres://x' })).toBe(false);
    });

    it('validateSqlConnectionUrl: blank ok, sql scheme ok, garbage + mongodb rejected', () => {
      expect.assertions(5);
      expect(options.validateSqlConnectionUrl('')).toBe(true);
      expect(options.validateSqlConnectionUrl('postgres://u:p@h:5432/db')).toBe(true);
      expect(options.validateSqlConnectionUrl('mysql://u:p@h:3306/db')).toBe(true);
      expect(typeof options.validateSqlConnectionUrl('postgres-not-a-url')).toBe('string');
      expect(typeof options.validateSqlConnectionUrl('mongodb://h/db')).toBe('string');
    });

    it('validateSqlConnectionUrl: rejects mariadb:// (driver not shipped with generated projects)', () => {
      expect.assertions(1);
      expect(typeof options.validateSqlConnectionUrl('mariadb://u:p@h:3306/db')).toBe('string');
    });

    it('validateSqlConnectionUrl: rejects uppercase schemes (getDialect matches lowercase only)', () => {
      expect.assertions(2);
      expect(options.validateSqlConnectionUrl('Postgres://u:p@h:5432/db')).toBe(
        'Enter a URL like postgres://…, mysql://… or mssql://… (the scheme must be lowercase)',
      );
      expect(options.getDialect({ databaseConnectionURL: 'postgres://u:p@h:5432/db' })).toBe(
        'postgres',
      );
    });

    it('validateMongoConnectionUrl: blank ok, mongodb(+srv) ok, sql + uppercase rejected', () => {
      expect.assertions(4);
      expect(options.validateMongoConnectionUrl('')).toBe(true);
      expect(options.validateMongoConnectionUrl('mongodb+srv://h/db')).toBe(true);
      expect(typeof options.validateMongoConnectionUrl('postgres://h/db')).toBe('string');
      expect(options.validateMongoConnectionUrl('MongoDB://h/db')).toBe(
        'Enter a mongodb:// or mongodb+srv:// URL (the scheme must be lowercase)',
      );
    });
  });
});
