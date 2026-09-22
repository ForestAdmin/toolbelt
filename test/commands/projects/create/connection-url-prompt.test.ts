import inquirer from 'inquirer';
import { PassThrough, Readable } from 'stream';

import NosqlCommand from '../../../../src/commands/projects/create/nosql';
import SqlCommand from '../../../../src/commands/projects/create/sql';
import { getInteractiveOptions } from '../../../../src/utils/option-parser';

// The command test helper stubs inquirer, so it cannot prove a `when` predicate skipped a
// question. This drives the real inquirer against the real command options.
jest.mock('@forestadmin/context', () => ({
  ...jest.requireActual('@forestadmin/context'),
  inject: () => (global as unknown as { __promptContext: unknown }).__promptContext,
}));

class ScriptedInput extends Readable {
  // eslint-disable-next-line class-methods-use-this, no-underscore-dangle
  _read() {} // Pushed to manually, one answer at a time.
}

/** Resolves once inquirer stops rendering, i.e. the next question is waiting. */
function waitForIdle(output: PassThrough, idleMs = 40, timeoutMs = 5000): Promise<void> {
  return new Promise(resolve => {
    let idleTimer: NodeJS.Timeout;
    let overallTimer: NodeJS.Timeout;

    function onData() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(done, idleMs); // eslint-disable-line no-use-before-define
    }

    function done() {
      clearTimeout(idleTimer);
      clearTimeout(overallTimer);
      output.off('data', onData);
      resolve();
    }

    idleTimer = setTimeout(done, idleMs);
    overallTimer = setTimeout(done, timeoutMs);
    output.on('data', onData);
  });
}

/** Each answer names the question it replies to, so the sequence reads as the flow under test. */
type Answer = [question: string, answer: string];

async function answerPrompts(
  commandClass: { options: unknown },
  answers: Answer[],
): Promise<{ answered: Record<string, unknown>; displayed: string }> {
  const input = new ScriptedInput();
  const output = new PassThrough();
  const chunks: string[] = [];
  output.on('data', chunk => chunks.push(chunk.toString()));

  const promptModule = inquirer.createPromptModule({ input, output } as never);
  (global as unknown as { __promptContext: unknown }).__promptContext = {
    os: { platform: () => 'darwin' },
    inquirer: { prompt: (questions: unknown) => promptModule(questions as never) },
  };

  const promise = getInteractiveOptions<Record<string, unknown>>(commandClass.options as never, {});

  await waitForIdle(output);

  // eslint-disable-next-line no-restricted-syntax
  for (const [, answer] of answers) {
    input.push(`${answer}\n`);
    // eslint-disable-next-line no-await-in-loop
    await waitForIdle(output);
  }

  return { answered: await promise, displayed: chunks.join('') };
}

describe('projects:create connection URL prompt', () => {
  jest.setTimeout(30000);

  describe('on projects:create:sql', () => {
    it('should skip the database field prompts once a URL is answered', async () => {
      expect.assertions(2);

      const { answered } = await answerPrompts(SqlCommand as never, [
        ['databaseConnectionURL', 'postgres://user:secret@localhost:5432/db'],
        ['databaseSchema', ''],
        ['applicationHost', ''],
        ['applicationPort', ''],
        ['language', ''],
      ]);

      expect(Object.keys(answered)).toStrictEqual([
        'databaseConnectionURL',
        'databaseSchema',
        'applicationHost',
        'applicationPort',
        'language',
      ]);
      expect(answered).toMatchObject({
        databaseConnectionURL: 'postgres://user:secret@localhost:5432/db',
        databaseSchema: 'public',
      });
    });

    it('should fall back to the field prompts when the URL is left blank', async () => {
      expect.assertions(1);

      const { answered } = await answerPrompts(SqlCommand as never, [
        ['databaseConnectionURL', ''],
        ['databaseDialect', ''],
        ['databaseName', 'mydb'],
        ['databaseSchema', ''],
        ['databaseHost', ''],
        ['databasePort', ''],
        ['databaseUser', ''],
        ['databasePassword', 'pwd'],
        ['applicationHost', ''],
        ['applicationPort', ''],
        ['language', ''],
      ]);

      expect(Object.keys(answered)).toStrictEqual([
        'databaseConnectionURL',
        'databaseDialect',
        'databaseName',
        'databaseSchema',
        'databaseHost',
        'databasePort',
        'databaseUser',
        'databasePassword',
        'applicationHost',
        'applicationPort',
        'language',
      ]);
    });

    it('should never echo the pasted credentials, and should trim the URL', async () => {
      expect.assertions(3);

      const { answered, displayed } = await answerPrompts(SqlCommand as never, [
        ['databaseConnectionURL', '  postgres://user:MyTopSecret@localhost:5432/db  '],
        ['databaseSchema', ''],
        ['applicationHost', ''],
        ['applicationPort', ''],
        ['language', ''],
      ]);

      expect(displayed).not.toContain('MyTopSecret');
      expect(displayed).toContain('****');
      expect(answered.databaseConnectionURL).toBe('postgres://user:MyTopSecret@localhost:5432/db');
    });
  });

  describe('on projects:create:nosql', () => {
    it('should offer the URL question and skip the field prompts once it is answered', async () => {
      expect.assertions(2);

      const { answered, displayed } = await answerPrompts(NosqlCommand as never, [
        ['databaseConnectionURL', 'mongodb+srv://user:MyTopSecret@cluster/db'],
        ['applicationHost', ''],
        ['applicationPort', ''],
        ['language', ''],
      ]);

      expect(Object.keys(answered)).toStrictEqual([
        'databaseConnectionURL',
        'applicationHost',
        'applicationPort',
        'language',
      ]);
      expect(displayed).not.toContain('MyTopSecret');
    });

    it('should fall back to the field prompts, SRV included, when the URL is left blank', async () => {
      expect.assertions(3);

      const { answered } = await answerPrompts(NosqlCommand as never, [
        ['databaseConnectionURL', ''],
        ['databaseName', 'mydb'],
        ['databaseHost', ''],
        ['databasePort', ''],
        ['databaseUser', ''],
        ['databasePassword', 'pwd'],
        ['mongoDBSRV', ''],
        ['applicationHost', ''],
        ['applicationPort', ''],
        ['language', ''],
      ]);

      expect(Object.keys(answered)).toStrictEqual([
        'databaseConnectionURL',
        'databaseName',
        'databaseHost',
        'databasePort',
        'databaseUser',
        'databasePassword',
        'mongoDBSRV',
        'applicationHost',
        'applicationPort',
        'language',
      ]);
      expect(answered.mongoDBSRV).toBe(false);
      expect(answered).toMatchObject({ databasePort: '27017', databaseUser: '' });
    });
  });
});
