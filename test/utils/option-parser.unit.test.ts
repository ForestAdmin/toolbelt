import type { Command } from '@oclif/core';

import SqlCommand from '../../src/commands/projects/create/sql';
import { getCommandLineOptions } from '../../src/utils/option-parser';

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
