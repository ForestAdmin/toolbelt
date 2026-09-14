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

    it('validateSqlConnectionUrl: blank (or whitespace-only) and sql schemes are accepted', () => {
      expect.assertions(6);
      expect(options.validateSqlConnectionUrl('')).toBe(true);
      // A whitespace-only paste means the same thing as a blank answer: fill the fields.
      expect(options.validateSqlConnectionUrl('   ')).toBe(true);
      expect(options.validateSqlConnectionUrl('postgres://u:p@h:5432/db')).toBe(true);
      expect(options.validateSqlConnectionUrl('postgresql://u:p@h:5432/db')).toBe(true);
      expect(options.validateSqlConnectionUrl('mysql://u:p@h:3306/db')).toBe(true);
      expect(options.validateSqlConnectionUrl('mssql://u:p@h:1433/db')).toBe(true);
    });

    it('validateSqlConnectionUrl: accepts a URL pasted with surrounding whitespace', () => {
      expect.assertions(2);
      expect(options.validateSqlConnectionUrl('  postgres://u:p@h:5432/db')).toBe(true);
      expect(options.validateSqlConnectionUrl('postgres://u:p@h:5432/db\n')).toBe(true);
    });

    it('validateSqlConnectionUrl: each rejection says what is actually wrong', () => {
      expect.assertions(5);
      expect(options.validateSqlConnectionUrl('postgres-not-a-url')).toBe(
        'Enter a connection URL like postgres://user:password@host:5432/db',
      );
      expect(options.validateSqlConnectionUrl('postgres://')).toBe(
        'The URL is missing everything after "postgres://" — try postgres://user:password@host:5432/db',
      );
      expect(options.validateSqlConnectionUrl('mongodb://h/db')).toBe(
        '"mongodb://" is not supported, expected postgres://, postgresql://, mysql://, mssql://',
      );
      expect(options.validateSqlConnectionUrl('pg://u@h/db')).toBe(
        '"pg://" is not supported, expected postgres://, postgresql://, mysql://, mssql://',
      );
      // The scheme is loosely matched by getDialect(), so it must not slip through.
      expect(options.validateSqlConnectionUrl('postgresfoo://bar')).toBe(
        '"postgresfoo://" is not supported, expected postgres://, postgresql://, mysql://, mssql://',
      );
    });

    it('validateSqlConnectionUrl: does not resolve a scheme on the prototype', () => {
      expect.assertions(1);
      // The scheme is user input and indexes the per-engine hint map.
      expect(options.validateSqlConnectionUrl('constructor://x')).toBe(
        '"constructor://" is not supported, expected postgres://, postgresql://, mysql://, mssql://',
      );
    });

    it('validateSqlConnectionUrl: points mariadb:// at mysql:// (driver not shipped)', () => {
      expect.assertions(2);
      const message = 'mariadb:// is not supported by the generated project, use mysql:// instead';
      expect(options.validateSqlConnectionUrl('mariadb://u:p@h:3306/db')).toBe(message);
      expect(options.validateSqlConnectionUrl('MariaDB://u:p@h:3306/db')).toBe(message);
    });

    it('validateSqlConnectionUrl: rejects uppercase schemes (getDialect matches lowercase only)', () => {
      expect.assertions(3);
      expect(options.validateSqlConnectionUrl('Postgres://u:p@h:5432/db')).toBe(
        'The scheme must be lowercase: use "postgres://"',
      );
      expect(options.validateSqlConnectionUrl('MYSQL://u:p@h:3306/db')).toBe(
        'The scheme must be lowercase: use "mysql://"',
      );
      expect(options.getDialect({ databaseConnectionURL: 'postgres://u:p@h:5432/db' })).toBe(
        'postgres',
      );
    });

    it('validateMongoConnectionUrl: blank ok, mongodb(+srv) ok, sql + uppercase rejected', () => {
      expect.assertions(5);
      expect(options.validateMongoConnectionUrl('')).toBe(true);
      expect(options.validateMongoConnectionUrl('mongodb://h/db')).toBe(true);
      expect(options.validateMongoConnectionUrl(' mongodb+srv://h/db ')).toBe(true);
      expect(options.validateMongoConnectionUrl('postgres://h/db')).toBe(
        '"postgres://" is not supported, expected mongodb://, mongodb+srv://',
      );
      expect(options.validateMongoConnectionUrl('MongoDB://h/db')).toBe(
        'The scheme must be lowercase: use "mongodb://"',
      );
    });
  });
});
