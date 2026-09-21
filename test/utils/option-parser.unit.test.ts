import type { Command } from '@oclif/core';

import SqlCommand from '../../src/commands/projects/create/sql';
import { getCommandLineOptions } from '../../src/utils/option-parser';

jest.mock('@forestadmin/context', () => ({
  ...jest.requireActual('@forestadmin/context'),
  inject: () => (global as unknown as { __optionParserContext: unknown }).__optionParserContext,
}));

/** Runs the real `projects:create:sql` options against a given set of flags. */
async function parseFlags(flags: Record<string, unknown>): Promise<{
  options: Record<string, unknown>;
  questions: string[];
}> {
  const questions: string[] = [];

  (global as unknown as { __optionParserContext: unknown }).__optionParserContext = {
    os: { platform: () => 'darwin' },
    inquirer: {
      prompt: (asked: Array<{ name: string }>) => {
        questions.push(...asked.map(question => question.name));

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

describe('utils > option-parser', () => {
  describe('getCommandLineOptions', () => {
    describe('when a flag declares a filter', () => {
      it('should normalize the value the same way the prompt does', async () => {
        expect.assertions(2);

        const { options, questions } = await parseFlags({
          databaseConnectionURL: '  postgres://u:p@localhost:5432/db\n',
        });

        expect(options.databaseConnectionURL).toBe('postgres://u:p@localhost:5432/db');
        // The URL was provided: the field prompts it is exclusive with are not asked.
        expect(questions).not.toContain('databaseName');
      });

      describe('when the filter empties the value', () => {
        // `-c '  '` is not a connection URL. Left as-is it suppressed every database field
        // prompt (they are exclusive with it) and was then normalized away, leaving the
        // command with neither a URL nor a dialect: "Missing database dialect option value".
        it('should treat the flag as not provided and ask the questions', async () => {
          expect.assertions(2);

          const { options, questions } = await parseFlags({ databaseConnectionURL: '   ' });

          expect(options.databaseConnectionURL).toBeUndefined();
          expect(questions).toStrictEqual(
            expect.arrayContaining([
              'databaseConnectionURL',
              'databaseDialect',
              'databaseName',
              'databaseHost',
              'databasePort',
              'databaseUser',
              'databasePassword',
            ]),
          );
        });
      });
    });

    describe('when a flag without a filter is given an empty value', () => {
      // Only a filter can empty a value, and only the options that declare one opt into this.
      // An empty `--databaseSchema` still means "no schema", not "ask me".
      it('should keep it as provided', async () => {
        expect.assertions(2);

        const { options, questions } = await parseFlags({ databaseSchema: '' });

        expect(options.databaseSchema).toBe('');
        expect(questions).not.toContain('databaseSchema');
      });
    });

    describe('when a flag fails its validation', () => {
      it('should throw before anything is asked', async () => {
        expect.assertions(1);

        await expect(
          parseFlags({ databaseConnectionURL: 'mariadb://u:p@localhost/db' }),
        ).rejects.toThrow(
          'Invalid value for databaseConnectionURL: mariadb:// is not supported by the generated project, use mysql:// instead',
        );
      });
    });
  });
});
