const fs = require('fs');

const StartCommand = require('../../src/commands/start').default;
const { runCapture, runStep, startProcess } = require('../../src/services/process-runner');
const testCli = require('./test-cli-helper/test-cli');

// The process boundary: a test that goes past --dry-run spawns nothing, and says what came back.
jest.mock('../../src/services/process-runner');

// `--dry-run` prints every command instead of running it, so the whole orchestration can be
// asserted with no project created, no package installed and no process spawned. It is also what
// the flow is reviewed with, so testing it keeps the reviewed thing and the tested thing the same.
//
// stdin is not a TTY under the harness, so the interactive tails are skipped — each test asserts
// one flow's command sequence, deterministically.

describe('start', () => {
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
        std: [{ out: '--databaseConnectionURL <redacted>' }, { not: 'hunter2' }],
      });
    });

    it('skips the TypeScript build for a JavaScript scaffold, which has no build script', async () => {
      expect.hasAssertions();
      // What `create:sql` scaffolds when the user picks JavaScript: no build script.
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] !== 'projects:create:sql') return;
        fs.mkdirSync('x');
        fs.writeFileSync(
          'x/package.json',
          JSON.stringify({ scripts: { start: 'node ./index.js' } }),
        );
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x'],
        std: [{ out: 'Your back-office is live!' }, { not: '$ npm run build' }],
      });

      expect(runStep.mock.calls).toStrictEqual([
        [process.execPath, [process.argv[1], 'login'], { cwd: undefined }],
        [process.execPath, [process.argv[1], 'projects:create:sql', 'x'], { cwd: undefined }],
        ['npm', ['install'], { cwd: 'x' }],
      ]);
    });

    it('refuses a --name whose directory exists, before creating any project', async () => {
      expect.hasAssertions();
      runStep.mockReset();

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x'],
        files: [{ name: 'x/package.json', content: '{}' }],
        exitMessage: './x already exists — pass another --name.',
      });

      // Only the login ran: `create:sql` would have registered a project for the old app.
      expect(runStep.mock.calls).toStrictEqual([
        [process.execPath, [process.argv[1], 'login'], { cwd: undefined }],
      ]);
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
    it('stops before touching the Gemfile when no secret comes back, so the failure installs nothing', async () => {
      expect.hasAssertions();
      runStep.mockReset();
      runCapture.mockReset().mockResolvedValue({ stdout: '{}', stderr: '' });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        exitMessage:
          'Could not read FOREST_ENV_SECRET from `projects:create:in-app`. Nothing was installed — ' +
          'run it by hand and pass the secret to `bin/rails g forest_admin_rails:install`.',
      });

      expect(runCapture).toHaveBeenCalledWith(
        process.execPath,
        [
          process.argv[1],
          'projects:create:in-app',
          'app',
          '-H',
          'http://localhost',
          '-P',
          '3002',
          '--format',
          'json',
        ],
        { onProgress: expect.any(Function) },
      );
      // Only the login ran: past `bundle add`, five gems and a lockfile change are in the user's
      // repo while the error claims nothing was installed.
      expect(runStep.mock.calls).toStrictEqual([
        [process.execPath, [process.argv[1], 'login'], { cwd: undefined }],
      ]);
    });

    it('keeps the env secret out of the error when the Rails generator fails', async () => {
      expect.hasAssertions();
      runCapture
        .mockReset()
        .mockResolvedValue({ stdout: JSON.stringify({ envSecret: 'deadbeef' }), stderr: '' });
      // What the runner rejects with: it redacts secret flags, never a bare positional.
      runStep.mockReset().mockImplementation(async (command, args) => {
        if (command === 'bin/rails')
          throw new Error(`\`${command} ${args.join(' ')}\` exited with code 1`);
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'rails', '--name', 'app'],
        exitMessage: '`bin/rails g forest_admin_rails:install <redacted>` exited with code 1',
        std: [{ not: 'deadbeef' }],
      });
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

    it('shows the snippet for --mount ai when this CLI cannot install the skills the agent needs', async () => {
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
          'ai',
        ],
        std: [
          { out: 'here is the snippet instead' },
          { out: 'Add to your server' },
          { not: 'Your coding agent will wire the mount' },
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
        // Adjacent lines prove nothing ran in between. The `not`s prove nothing ran before either:
        // no in-app project created, no package written into the user's own app.
        std: [
          {
            out: 'Forest runs as its own back-end on your DB (no code change).\n\n$ forest projects:create:sql',
          },
          { not: 'projects:create:in-app' },
          { not: '$ npm install @forestadmin/agent' },
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
