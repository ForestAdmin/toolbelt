import type { Command } from '@oclif/core';

import SqlCommand from '../../src/commands/projects/create/sql';
import { getCommandLineOptions, getDefaultOptions } from '../../src/utils/option-parser';

jest.mock('@forestadmin/context', () => ({
  ...jest.requireActual('@forestadmin/context'),
  inject: () => (global as unknown as { __optionParserContext: unknown }).__optionParserContext,
}));

/** The questions of the last `parseFlags` call, readable after it rejects. */
let asked: string[] = [];

async function parseFlags(flags: Record<string, unknown>): Promise<{
  options: Record<string, unknown>;
  questions: string[];
}> {
  asked = [];
  const questions = asked;

  (global as unknown as { __optionParserContext: unknown }).__optionParserContext = {
    os: { platform: () => 'darwin' },
    inquirer: {
      prompt: (batch: Array<{ name: string }>) => {
        questions.push(...batch.map(question => question.name));

        return Promise.resolve({});
      },
    },
  };

  const instance = {
    constructor: SqlCommand,
    parse: async () => ({ args: {}, flags }),
  } as unknown as Command;

  return { options: await getCommandLineOptions(instance), questions };
}

type Question = { name: string; validate?: (v: string) => boolean | string };

/** The questions `projects:create:sql` asks when no flag answers them. */
async function askedQuestions(): Promise<{ url: Question }> {
  let questions: Question[] = [];

  (global as unknown as { __optionParserContext: unknown }).__optionParserContext = {
    os: { platform: () => 'darwin' },
    inquirer: {
      prompt: (batch: Question[]) => {
        questions = batch;

        return Promise.resolve({});
      },
    },
  };

  const instance = {
    constructor: SqlCommand,
    parse: async () => ({ args: {}, flags: {} }),
  } as unknown as Command;

  await getCommandLineOptions(instance);

  return { url: questions.find(question => question.name === 'databaseConnectionURL') as Question };
}

describe('utils > option-parser', () => {
  describe('getCommandLineOptions', () => {
    describe('when a flag declares a filter', () => {
      it('should normalize the value the same way the prompt does', async () => {
        expect.assertions(2);

        const { options, questions } = await parseFlags({
          databaseConnectionURL: '  postgres://u:p@localhost:5432/db\n',
        });

        expect(options.databaseConnectionURL).toBe('postgres://u:p@localhost:5432/db');
        expect(questions).not.toContain('databaseName');
      });

      describe('when the filter empties the value', () => {
        it('should refuse the flag, name it, and ask nothing', async () => {
          expect.assertions(2);

          await expect(parseFlags({ databaseConnectionURL: '   ' })).rejects.toThrow(
            'Invalid value for databaseConnectionURL: the flag was passed an empty value, omit it to be asked instead',
          );
          expect(asked).toStrictEqual([]);
        });
      });
    });

    describe('when a flag without a filter is given an empty value', () => {
      it('should keep it as provided', async () => {
        expect.assertions(2);

        const { options, questions } = await parseFlags({ databaseSchema: '' });

        expect(options.databaseSchema).toBe('');
        expect(questions).not.toContain('databaseSchema');
      });
    });

    describe('when a flag carries a value the prompt would refuse', () => {
      it('should accept it, leaving the flag as permissive as it was', async () => {
        expect.assertions(1);

        const { options } = await parseFlags({
          databaseConnectionURL: 'mariadb://u:p@localhost/db',
        });

        expect(options.databaseConnectionURL).toBe('mariadb://u:p@localhost/db');
      });
    });

    describe('when an option declares a prompt validator', () => {
      it('should hand it to the question instead of gating the flag', async () => {
        expect.assertions(2);

        const { url } = await askedQuestions();

        expect(url.validate?.('mariadb://u:p@localhost/db')).toBe(
          'mariadb:// is not supported by the generated project, use mysql:// instead',
        );
        expect(url.validate?.('postgres://u:p@localhost:5432/db')).toBe(true);
      });
    });
  });

  describe('getDefaultOptions', () => {
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
        databaseConnectionURL: {
          default: 'ignored',
          oclif: { description: 'url' },
          prompter: null,
        },
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

      expect(getDefaultOptions(options, { databaseConnectionURL: 'postgres://x' })).toStrictEqual(
        {},
      );
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
});
