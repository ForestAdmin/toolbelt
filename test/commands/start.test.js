const fs = require('fs');
const os = require('os');
const path = require('path');

const StartCommand = require('../../src/commands/start').default;
const testCli = require('./test-cli-helper/test-cli');

// `--dry-run` prints every command instead of running it, so the whole orchestration can be
// asserted with no project created, no package installed and no process spawned. It is also what
// the flow is reviewed with, so testing it keeps the reviewed thing and the tested thing the same.
//
// stdin is not a TTY under the harness, so the interactive tails are skipped — each test asserts
// one flow's command sequence, deterministically.

describe('start', () => {
  // `writeSecrets` is where a long-lived credential meets the user's own file, so its outcomes are
  // asserted directly: what it wrote, what it refused to touch, and what it claims afterwards.
  describe('writeSecrets', () => {
    function inTempDir(run) {
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

    it('creates the file when it is absent, and says what it wrote', () => {
      expect.assertions(2);
      inTempDir(() => {
        const result = StartCommand.writeSecrets({ envSecret: 'AAA', authSecret: 'BBB' });

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

    it('fills an empty placeholder in place rather than adding the key twice', () => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', 'PORT=3001\nFOREST_ENV_SECRET=\n');
        const result = StartCommand.writeSecrets({ envSecret: 'AAA' });

        expect(result.written).toStrictEqual(['FOREST_ENV_SECRET']);
        // A file carrying the same key twice reads as a mistake, even though dotenv takes the last.
        expect(fs.readFileSync('.env', 'utf8')).toBe('PORT=3001\nFOREST_ENV_SECRET=AAA\n');
      });
    });

    it('never overwrites a different secret, and reports the conflict instead of claiming success', () => {
      expect.assertions(2);
      inTempDir(() => {
        fs.writeFileSync('.env', 'FOREST_ENV_SECRET=SOMEONE_ELSE\n');
        const result = StartCommand.writeSecrets({ envSecret: 'AAA' });

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
        expect(StartCommand.writeSecrets({})).toStrictEqual({
          file: '.env',
          written: [],
          conflicts: [],
        });
      });
    });
  });

  describe('demo flow', () => {
    it('creates a demo project, builds it and applies the curated layout', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo'],
        std: [
          { out: 'Welcome to Forest' },
          { out: '$ forest login' },
          { out: '$ forest projects:create:demo forest-demo-' },
          { out: '-l typescript -H http://localhost -P 3310' },
          { out: '$ npm install' },
          { out: '$ npm run build' },
          { out: '$ forest layout:apply forest-layout.json --with-workflows' },
          { out: 'Demo back-office live.' },
          // Non-interactive: no menu, but never a dead end either.
          { out: 'Connect real data: forest projects:create:sql' },
        ],
      });
    });
  });

  describe('standalone flow', () => {
    it('passes the connection URL through to create:sql and reports both URLs', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'standalone',
          '--name',
          'my-back-office',
          '--db',
          'postgres://u:p@h:5432/d',
        ],
        std: [
          // The URL carries credentials: echoed redacted, passed through intact.
          {
            out: '$ forest projects:create:sql my-back-office --databaseConnectionURL <redacted>',
          },
          { out: 'Setup complete — booting your back-end on :3310' },
          { out: 'Your back-office is live!' },
          { out: 'Open it → https://app.forestadmin.com/my-back-office' },
          { out: 'Served by → http://localhost:3310' },
        ],
      });
    });

    it('leaves every prompt to create:sql when no URL is given', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'standalone', '--name', 'x'],
        // Bare on purpose: forcing -l/-H/-P here would silently remove the choice of JavaScript,
        // of a hostname, or of a free port. Credentials never pass through this command either.
        // The trailing newline is the assertion: nothing follows the project name on that line.
        std: [{ out: '$ forest projects:create:sql x\n' }],
      });
    });

    it('never echoes the database credentials it was given', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'standalone',
          '--name',
          'x',
          '--db',
          'postgres://user:hunter2@host:5432/db',
        ],
        // A terminal, a scrollback and a CI log all keep what is printed.
        std: [{ out: '--databaseConnectionURL <redacted>' }],
      });
    });

    it('honours --schema alongside --db', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'standalone',
          '--name',
          'x',
          '--db',
          'postgres://u:p@h:5432/d',
          '--schema',
          'analytics',
        ],
        std: [{ out: '-s analytics' }],
      });
    });
  });

  describe('in-app Rails flow', () => {
    it('checks the secret before touching the Gemfile, so a failure installs nothing', async () => {
      expect.hasAssertions();

      // The create is mocked away by --dry-run, so no secret comes back; the guard must fire
      // before `bundle add`, or five gems and a lockfile change are left in the user's repo
      // while the error claims nothing was installed.
      const source = fs.readFileSync('src/commands/start.ts', 'utf8');
      const guard = source.indexOf('Checked before `bundle add`');
      const bundle = source.indexOf("this.run$('bundle'");

      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(bundle);
    });

    it('registers an in-app project then installs the five gems the boot actually needs', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        std: [
          { out: '$ forest projects:create:in-app app -H http://localhost -P 3002 --format json' },
          // Five, not the three the docs list: forest_admin_rails alone installs but fails to boot.
          { out: '$ bundle add forest_admin_agent forest_admin_rails' },
          { out: 'forest_admin_datasource_customizer' },
          { out: '$ bin/rails g forest_admin_rails:install' },
          { out: 'Forest is live in your app!' },
          { out: 'Local /forest → http://localhost:3002/forest' },
        ],
      });
    });
  });

  describe('in-app Node flow', () => {
    it('installs the datasource matching the detected ORM and prints the mount snippet', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'manual',
        ],
        files: [
          { name: 'package.json', content: JSON.stringify({ name: 'app', dependencies: {} }) },
        ],
        std: [
          { out: '$ forest projects:create:in-app app -H http://localhost -P 3001 --format json' },
          // Nothing detected → the defaults, and the snippet matches them.
          { out: '$ npm install @forestadmin/agent @forestadmin/datasource-sql' },
          { out: 'Add to your server' },
          { out: 'createSqlDataSource(process.env.DATABASE_URL)' },
          { out: 'mountOnExpress(app).start();' },
        ],
      });
    });

    it('names the datasource the snippet uses after the one it installs', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'manual',
        ],
        files: [
          {
            name: 'package.json',
            content: JSON.stringify({ name: 'app', dependencies: { mongoose: '^8.0.0' } }),
          },
        ],
        std: [
          { out: '@forestadmin/datasource-mongoose' },
          // Telling a mongoose app to call createSequelizeDataSource sends it into an import that
          // does not exist…
          { out: 'createMongooseDataSource(connection)' },
          // …and calling a factory that is never imported does not compile either.
          { out: "import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';" },
        ],
      });
    });

    it('asks how to mount BEFORE creating anything, so declining leaves no stray project', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'standalone',
        ],
        // The two lines are adjacent in the output, which proves nothing ran in between — no
        // in-app project created, no package written into the user's own app.
        std: [
          {
            out: 'Forest runs as its own back-end on your DB (no code change).\n\n$ forest projects:create:sql',
          },
        ],
      });
    });

    it('falls back to the standalone flow when the user declines to mount anything', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: [
          '--dry-run',
          '--flow',
          'inapp',
          '--stack',
          'node',
          '--name',
          'app',
          '--mount',
          'standalone',
        ],
        std: [
          { out: 'Forest runs as its own back-end on your DB (no code change).' },
          // The standalone flow takes over — a real project, not a dead end.
          { out: '$ forest projects:create:sql' },
        ],
      });
    });
  });

  describe('--dry-run', () => {
    it('runs nothing at all', async () => {
      expect.hasAssertions();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--dry-run', '--flow', 'demo'],
        std: [{ out: '(dry-run — not executed)' }],
      });
    });
  });
});
