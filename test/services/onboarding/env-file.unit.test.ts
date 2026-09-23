import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  bootSecrets,
  keysLoadedFromDotenv,
  writeSecrets,
} from '../../../src/services/onboarding/env-file';

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
          exposed: false,
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

    it('restricts an existing file it writes secrets into, whatever mode it had', () => {
      expect.assertions(1);
      inTempDir(() => {
        fs.writeFileSync('.env', 'PORT=3001\n', { mode: 0o644 });
        writeSecrets({ envSecret: 'AAA' }, {});

        // eslint-disable-next-line no-bitwise -- the permission bits of a file mode
        expect(fs.statSync('.env').mode & 0o777).toBe(0o600);
      });
    });

    it('still writes, and reports the file exposed, when its mode cannot be changed', () => {
      expect.assertions(2);
      inTempDir(() => {
        const chmod = jest.spyOn(fs, 'chmodSync').mockImplementation(() => {
          throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
        });
        try {
          const result = writeSecrets({ envSecret: 'AAA' }, {});

          expect(result.exposed).toBe(true);
          expect(fs.readFileSync('.env', 'utf8')).toBe('FOREST_ENV_SECRET=AAA\n');
        } finally {
          chmod.mockRestore();
        }
      });
    });

    it('leaves the mode of a file it had nothing to write into', () => {
      expect.assertions(1);
      inTempDir(() => {
        fs.writeFileSync('.env', 'FOREST_ENV_SECRET=AAA\n', { mode: 0o644 });
        writeSecrets({ envSecret: 'AAA' }, {});

        // eslint-disable-next-line no-bitwise -- the permission bits of a file mode
        expect(fs.statSync('.env').mode & 0o777).toBe(0o644);
      });
    });

    it.each([
      ['a hex secret, bare as always', 'a1b2c3', 'FOREST_AUTH_SECRET=a1b2c3\n'],
      ['a # that would start a comment', 'abc#def', "FOREST_AUTH_SECRET='abc#def'\n"],
      ['a space that would be trimmed', 'a b ', "FOREST_AUTH_SECRET='a b '\n"],
      ['a single quote', "it's#1", 'FOREST_AUTH_SECRET="it\'s#1"\n'],
    ])('writes %s so that dotenv reads it back unchanged', (_, value, written) => {
      expect.assertions(2);
      inTempDir(() => {
        writeSecrets({ authSecret: value }, {});

        const content = fs.readFileSync('.env', 'utf8');
        expect(content).toBe(written);
        expect(dotenv.parse(content).FOREST_AUTH_SECRET).toBe(value);
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
          exposed: false,
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

    // Each line read as dotenv 17 reads it: a placeholder is filled, the same value is left alone.
    it.each([
      ['a commented placeholder', 'FOREST_ENV_SECRET= # fill me\n', 'written'],
      ['a placeholder that is only a comment', 'FOREST_ENV_SECRET=#x\n', 'written'],
      ['an empty quoted placeholder with a comment', 'FOREST_ENV_SECRET=""  # empty\n', 'written'],
      ['the same value, quoted, with a comment', 'FOREST_ENV_SECRET="AAA" # c\n', 'unchanged'],
      ['the same value before an unspaced comment', 'FOREST_ENV_SECRET=AAA#note\n', 'unchanged'],
    ])('reads %s as dotenv does', (_, existing, outcome) => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', existing);
        const result = writeSecrets({ envSecret: 'AAA' }, {});

        expect(result.conflicts).toStrictEqual([]);
        expect(result.written).toStrictEqual(outcome === 'written' ? ['FOREST_ENV_SECRET'] : []);
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
          exposed: false,
        });
      });
    });
  });

  // Against the real process.env, loaded the way this CLI loads it at startup: an environment
  // passed by hand cannot tell a key this CLI read from `.env` from one the shell exports.
  describe('with the .env this CLI loaded itself', () => {
    function withLoadedDotenv(content: string, run: () => void): void {
      inTempDir(() => {
        fs.writeFileSync('.env', content);
        const loaded = Object.keys(dotenv.parse(content));
        dotenv.config();
        try {
          run();
        } finally {
          loaded.forEach(key => delete process.env[key]);
        }
      });
    }

    it('lists what it loaded, and not what the shell exports', () => {
      expect.assertions(1);
      process.env.FOREST_START_SHELL_ONLY = 'shell';
      try {
        withLoadedDotenv('FOREST_ENV_SECRET=\nPORT=3001\n', () => {
          expect(keysLoadedFromDotenv()).toStrictEqual(['FOREST_ENV_SECRET', 'PORT']);
        });
      } finally {
        delete process.env.FOREST_START_SHELL_ONLY;
      }
    });

    it('fills a placeholder and hands the first boot its value once the loaded keys are forgotten', () => {
      expect.assertions(2);
      withLoadedDotenv('FOREST_ENV_SECRET=\n', () => {
        // What `forest start` does before anything else.
        keysLoadedFromDotenv().forEach(key => delete process.env[key]);
        const written = writeSecrets({ envSecret: 'AAA' });

        expect(written.shadowed).toStrictEqual([]);
        expect(bootSecrets({ envSecret: 'AAA' }, written)).toStrictEqual({
          FOREST_ENV_SECRET: 'AAA',
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
