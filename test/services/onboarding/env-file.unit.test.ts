import fs from 'fs';
import os from 'os';
import path from 'path';

import { bootSecrets, writeSecrets } from '../../../src/services/onboarding/env-file';

// A helper (not a jest hook) — this repo forbids beforeEach/afterEach (jest/no-hooks).
function inTempDir(run: () => void): void {
  const previous = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-'));
  process.chdir(dir);
  try {
    run();
  } finally {
    process.chdir(previous);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Where a long-lived credential meets the user's own file: what it wrote, what it refused to
// touch, and what it claims afterwards.
describe('onboarding env-file', () => {
  describe('writeSecrets', () => {
    it('creates the file when it is absent, and says what it wrote', () => {
      expect.assertions(2);
      inTempDir(() => {
        const result = writeSecrets({ envSecret: 'AAA', authSecret: 'BBB' }, {});

        expect(result).toStrictEqual({
          file: '.env',
          written: ['FOREST_ENV_SECRET', 'FOREST_AUTH_SECRET'],
          conflicts: [],
          shadowed: [],
        });
        expect(fs.readFileSync('.env', 'utf8')).toBe(
          'FOREST_ENV_SECRET=AAA\nFOREST_AUTH_SECRET=BBB\n',
        );
      });
    });

    it('creates the file readable by its owner alone, since it holds long-lived secrets', () => {
      expect.assertions(1);
      inTempDir(() => {
        writeSecrets({ envSecret: 'AAA' }, {});

        // eslint-disable-next-line no-bitwise -- the permission bits of a file mode
        expect(fs.statSync('.env').mode & 0o777).toBe(0o600);
      });
    });

    it('starts the appended secrets on a new line when the file does not end with one', () => {
      expect.assertions(1);
      inTempDir(() => {
        fs.writeFileSync('.env', 'PORT=3001');
        writeSecrets({ envSecret: 'AAA' }, {});

        expect(fs.readFileSync('.env', 'utf8')).toBe('PORT=3001\nFOREST_ENV_SECRET=AAA\n');
      });
    });

    it('fills an empty placeholder in place rather than adding the key twice', () => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', 'PORT=3001\nFOREST_ENV_SECRET=\n');
        const result = writeSecrets({ envSecret: 'AAA' }, {});

        expect(result.written).toStrictEqual(['FOREST_ENV_SECRET']);
        // A file carrying the same key twice reads as a mistake, even though dotenv takes the last.
        expect(fs.readFileSync('.env', 'utf8')).toBe('PORT=3001\nFOREST_ENV_SECRET=AAA\n');
      });
    });

    it('never overwrites a different secret, and reports the conflict instead of claiming success', () => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', 'FOREST_ENV_SECRET=SOMEONE_ELSE\n');
        const result = writeSecrets({ envSecret: 'AAA' }, {});

        // Silently reporting success here would leave the app on another project's credentials.
        expect(result).toStrictEqual({
          file: '.env',
          written: [],
          conflicts: ['FOREST_ENV_SECRET'],
          shadowed: [],
        });
        expect(fs.readFileSync('.env', 'utf8')).toBe('FOREST_ENV_SECRET=SOMEONE_ELSE\n');
      });
    });

    it.each([
      ['spaces around the sign', 'FOREST_ENV_SECRET = OLD\n'],
      ['an export', 'export FOREST_ENV_SECRET=OLD\n'],
      ['a quoted value', 'FOREST_ENV_SECRET="OLD"\n'],
      [
        'a placeholder followed by a real value, of which dotenv keeps the last',
        'FOREST_ENV_SECRET=\nFOREST_ENV_SECRET=OLD\n',
      ],
    ])('reads %s the way dotenv does, and reports the conflict', (_, existing) => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', existing);
        const result = writeSecrets({ envSecret: 'AAA' }, {});

        expect(result.conflicts).toStrictEqual(['FOREST_ENV_SECRET']);
        expect(fs.readFileSync('.env', 'utf8')).toBe(existing);
      });
    });

    it('fills a quoted empty placeholder in place, the one dotenv would load', () => {
      expect.assertions(1);
      inTempDir(() => {
        fs.writeFileSync('.env', 'FOREST_ENV_SECRET=OLD\nFOREST_ENV_SECRET=""\n');
        writeSecrets({ envSecret: 'AAA' }, {});

        expect(fs.readFileSync('.env', 'utf8')).toBe(
          'FOREST_ENV_SECRET=OLD\nFOREST_ENV_SECRET=AAA\n',
        );
      });
    });

    it('reports a key the shell already exports, since dotenv never overrides it', () => {
      expect.assertions(1);
      inTempDir(() => {
        const result = writeSecrets(
          { envSecret: 'AAA', authSecret: 'BBB' },
          { FOREST_AUTH_SECRET: 'OLD' },
        );

        expect(result.shadowed).toStrictEqual(['FOREST_AUTH_SECRET']);
      });
    });

    it('reports nothing written when no secret came back', () => {
      expect.assertions(1);
      inTempDir(() => {
        expect(writeSecrets({}, {})).toStrictEqual({
          file: '.env',
          written: [],
          conflicts: [],
          shadowed: [],
        });
      });
    });
  });

  describe('bootSecrets', () => {
    it('hands the boot every secret that came back', () => {
      expect.assertions(1);
      expect(
        bootSecrets({ envSecret: 'AAA', authSecret: 'BBB' }, { conflicts: [], shadowed: [] }),
      ).toStrictEqual({
        FOREST_ENV_SECRET: 'AAA',
        FOREST_AUTH_SECRET: 'BBB',
      });
    });

    it('leaves a conflicting key to .env, so the first boot and every restart use one project', () => {
      expect.assertions(1);
      expect(
        bootSecrets(
          { envSecret: 'AAA', authSecret: 'BBB' },
          { conflicts: ['FOREST_ENV_SECRET'], shadowed: [] },
        ),
      ).toStrictEqual({ FOREST_AUTH_SECRET: 'BBB' });
    });

    it('leaves a key the shell exports to the shell, where every restart reads it too', () => {
      expect.assertions(1);
      expect(
        bootSecrets(
          { envSecret: 'AAA', authSecret: 'BBB' },
          { conflicts: [], shadowed: ['FOREST_AUTH_SECRET'] },
        ),
      ).toStrictEqual({ FOREST_ENV_SECRET: 'AAA' });
    });

    it('never passes an empty secret, which would shadow the value in .env', () => {
      expect.assertions(1);
      expect(
        bootSecrets({ envSecret: 'AAA', authSecret: '' }, { conflicts: [], shadowed: [] }),
      ).toStrictEqual({
        FOREST_ENV_SECRET: 'AAA',
      });
    });
  });
});
