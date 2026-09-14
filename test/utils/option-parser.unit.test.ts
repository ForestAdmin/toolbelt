import { getDefaultOptions } from '../../src/utils/option-parser';

describe('option-parser > getDefaultOptions', () => {
  it('should answer prompted options with their declared default', () => {
    expect.assertions(1);

    const options = {
      applicationHost: {
        default: 'http://localhost',
        oclif: { description: 'host' },
        prompter: { question: 'host?' },
      },
    };

    expect(getDefaultOptions(options)).toStrictEqual({ applicationHost: 'http://localhost' });
  });

  it('should not override a value already given on the command line', () => {
    expect.assertions(1);

    const options = {
      applicationPort: {
        default: '3000',
        oclif: { description: 'port' },
        prompter: { question: 'port?' },
      },
    };

    expect(getDefaultOptions(options, { applicationPort: '8080' })).toStrictEqual({});
  });

  it('should skip options that would never have been prompted', () => {
    expect.assertions(1);

    const options = {
      // No prompter: a pure flag, left untouched.
      databaseConnectionURL: { default: 'ignored', oclif: { description: 'url' }, prompter: null },
      // No default to fall back on.
      databaseName: { oclif: { description: 'name' }, prompter: { question: 'name?' } },
    };

    expect(getDefaultOptions(options)).toStrictEqual({});
  });

  it('should skip an option shadowed by an exclusive one that is set', () => {
    expect.assertions(1);

    const options = {
      databaseHost: {
        exclusive: ['databaseConnectionURL'],
        default: 'localhost',
        oclif: { description: 'host' },
        prompter: { question: 'host?' },
      },
    };

    expect(getDefaultOptions(options, { databaseConnectionURL: 'postgres://x' })).toStrictEqual({});
  });

  it('should respect `when`, and feed it the answers resolved so far', () => {
    expect.assertions(2);

    const seen: unknown[] = [];
    const options = {
      databaseDialect: {
        default: 'postgres',
        oclif: { description: 'dialect' },
        prompter: { question: 'dialect?' },
      },
      databasePort: {
        // Mirrors the real databasePort default: it reads the dialect resolved above it.
        default: (v: { databaseDialect?: string }) =>
          v.databaseDialect === 'postgres' ? '5432' : '3306',
        when: (v: unknown) => {
          seen.push(v);

          return true;
        },
        oclif: { description: 'port' },
        prompter: { question: 'port?' },
      },
      databaseSchema: {
        default: 'public',
        when: () => false,
        oclif: { description: 'schema' },
        prompter: { question: 'schema?' },
      },
    };

    expect(getDefaultOptions(options)).toStrictEqual({
      databaseDialect: 'postgres',
      databasePort: '5432',
    });
    expect(seen).toStrictEqual([{ databaseDialect: 'postgres' }]);
  });
});
