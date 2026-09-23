import fs from 'fs';
import os from 'os';
import path from 'path';

import { writeSecrets } from '../../../src/services/onboarding/env-file';

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
        const result = writeSecrets({ envSecret: 'AAA', authSecret: 'BBB' });

        expect(result).toStrictEqual({
          file: '.env',
          written: ['FOREST_ENV_SECRET', 'FOREST_AUTH_SECRET'],
          conflicts: [],
        });
        expect(fs.readFileSync('.env', 'utf8')).toBe(
          'FOREST_ENV_SECRET=AAA\nFOREST_AUTH_SECRET=BBB\n',
        );
      });
    });

    it('starts the appended secrets on a new line when the file does not end with one', () => {
      expect.assertions(1);
      inTempDir(() => {
        fs.writeFileSync('.env', 'PORT=3001');
        writeSecrets({ envSecret: 'AAA' });

        expect(fs.readFileSync('.env', 'utf8')).toBe('PORT=3001\nFOREST_ENV_SECRET=AAA\n');
      });
    });

    it('fills an empty placeholder in place rather than adding the key twice', () => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', 'PORT=3001\nFOREST_ENV_SECRET=\n');
        const result = writeSecrets({ envSecret: 'AAA' });

        expect(result.written).toStrictEqual(['FOREST_ENV_SECRET']);
        // A file carrying the same key twice reads as a mistake, even though dotenv takes the last.
        expect(fs.readFileSync('.env', 'utf8')).toBe('PORT=3001\nFOREST_ENV_SECRET=AAA\n');
      });
    });

    it('never overwrites a different secret, and reports the conflict instead of claiming success', () => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', 'FOREST_ENV_SECRET=SOMEONE_ELSE\n');
        const result = writeSecrets({ envSecret: 'AAA' });

        // Silently reporting success here would leave the app on another project's credentials.
        expect(result).toStrictEqual({
          file: '.env',
          written: [],
          conflicts: ['FOREST_ENV_SECRET'],
        });
        expect(fs.readFileSync('.env', 'utf8')).toBe('FOREST_ENV_SECRET=SOMEONE_ELSE\n');
      });
    });

    it('reports nothing written when no secret came back', () => {
      expect.assertions(1);
      inTempDir(() => {
        expect(writeSecrets({})).toStrictEqual({
          file: '.env',
          written: [],
          conflicts: [],
        });
      });
    });
  });
});
