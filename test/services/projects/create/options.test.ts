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
});
