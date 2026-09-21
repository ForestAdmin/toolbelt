import inquirer from 'inquirer';
import { PassThrough, Readable } from 'stream';

import NosqlCommand from '../../../../src/commands/projects/create/nosql';
import SqlCommand from '../../../../src/commands/projects/create/sql';
import { getInteractiveOptions } from '../../../../src/utils/option-parser';

// The command test helper stubs inquirer and returns canned answers, so it cannot prove that the
// `when` predicates actually skip the field prompts. Here we run the real inquirer against the
// real command options and assert which questions the user is asked.
jest.mock('@forestadmin/context', () => ({
  ...jest.requireActual('@forestadmin/context'),
  inject: () => (global as unknown as { __promptContext: unknown }).__promptContext,
}));

class ScriptedInput extends Readable {
  // eslint-disable-next-line class-methods-use-this, no-underscore-dangle
  _read() {} // Pushed to manually, one answer at a time.
}

/** Resolves once inquirer stopped rendering, i.e. the next question is waiting for an answer. */
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

/** Answers the interactive questions of `commandClass` in order, and reports what was displayed. */
async function answerPrompts(
  commandClass: { options: unknown },
  answers: string[],
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
  for (const answer of answers) {
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
        'postgres://user:secret@localhost:5432/db',
        '', // database schema, still asked: it is not carried by the URL
        '', // application host
        '', // application port
        '', // language
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
        '', // no connection URL
        '', // dialect, first choice
        'mydb',
        '', // schema
        '', // host
        '', // port
        '', // user
        'pwd',
        '', // application host
        '', // application port
        '', // language
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
        '  postgres://user:MyTopSecret@localhost:5432/db  ',
        '',
        '',
        '',
        '',
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
        'mongodb+srv://user:MyTopSecret@cluster/db',
        '', // application host
        '', // application port
        '', // language
      ]);

      expect(Object.keys(answered)).toStrictEqual([
        'databaseConnectionURL',
        'applicationHost',
        'applicationPort',
        'language',
      ]);
      expect(displayed).not.toContain('MyTopSecret');
    });

    // The fallback branch of the default nosql run, and the only one that reaches the SRV
    // question: its `when` used to require a dialect this command sets after prompting.
    it('should fall back to the field prompts, SRV included, when the URL is left blank', async () => {
      expect.assertions(3);

      const { answered } = await answerPrompts(NosqlCommand as never, [
        '', // no connection URL
        'mydb',
        '', // host
        '', // port
        '', // user
        'pwd',
        '', // use a SRV connection string?
        '', // application host
        '', // application port
        '', // language
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
      // The defaults this command offers must not depend on a dialect it sets after prompting:
      // the port had none, so pressing enter was refused by the validator, and the user was
      // offered the SQL 'root'.
      expect(answered).toMatchObject({ databasePort: '27017', databaseUser: '' });
    });
  });
});
