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
});
