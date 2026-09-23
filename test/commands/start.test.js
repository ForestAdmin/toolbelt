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

  describe('demo flow, past --dry-run', () => {
    it('applies the demo layout without the secret of the .env it was started next to', async () => {
      expect.hasAssertions();
      // Each `forest` step gets this process's environment, and a child's dotenv never overrides
      // it: the secret it sees is the project `layout:apply -f` would land on.
      const seen = [];
      runStep.mockReset().mockImplementation(async (command, args) => {
        const step = command === process.execPath ? args[1] : `${command} ${args.join(' ')}`;
        seen.push([step, process.env.FOREST_ENV_SECRET]);
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: '.env', content: 'FOREST_ENV_SECRET=secret_of_a_real_project\n' }],
          std: [{ out: 'Demo back-office live.' }],
        });
      } finally {
        delete process.env.FOREST_ENV_SECRET;
      }

      expect(seen).toStrictEqual([
        ['login', undefined],
        ['projects:create:demo', undefined],
        ['npm install', undefined],
        ['layout:apply', undefined],
      ]);
    });

    it("keeps the CLI's own settings from that .env, which a scaffold's .env does not carry", async () => {
      expect.hasAssertions();
      // `layout:apply` runs in the scaffold: a token path set next to `forest start` must reach it.
      const seen = [];
      runStep.mockReset().mockImplementation(async (command, args) => {
        if (command === process.execPath) seen.push([args[1], process.env.TOKEN_PATH]);
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: '.env', content: 'TOKEN_PATH=/custom/tokens\n' }],
          std: [{ out: 'Demo back-office live.' }],
        });
      } finally {
        delete process.env.TOKEN_PATH;
      }

      expect(seen).toStrictEqual([
        ['login', '/custom/tokens'],
        ['projects:create:demo', '/custom/tokens'],
        ['layout:apply', '/custom/tokens'],
      ]);
    });

    it('draws another demo name when the directory already exists, before creating the project', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });
      const random = jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.123456) // forest-demo-4fzy, taken
        .mockReturnValueOnce(0.654321); // forest-demo-nk00

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          files: [{ name: 'forest-demo-4fzy/package.json', content: '{}' }],
          std: [{ out: 'Demo back-office live.' }],
        });
      } finally {
        random.mockRestore();
      }

      expect(runStep.mock.calls[1]).toStrictEqual([
        process.execPath,
        [
          process.argv[1],
          'projects:create:demo',
          'forest-demo-nk00',
          '-l',
          'typescript',
          '-H',
          'http://localhost',
          '-P',
          '3310',
        ],
        { cwd: undefined },
      ]);
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

    it('boots without the .env values this CLI loaded, so the back-end reads its own', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] !== 'projects:create:sql') return;
        fs.mkdirSync('x');
        fs.writeFileSync('x/package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
      });
      // The runner hands a child this process's environment, so that is what the back-end gets.
      let inherited;
      startProcess.mockReset().mockImplementation(() => {
        inherited = process.env.FOREST_START_LEAK;

        return { child: undefined, ready: Promise.resolve(), mute: () => {} };
      });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'standalone', '--name', 'x'],
          // Loaded into this process at startup, by a dotenv older than the app's.
          files: [
            { name: '.env', content: 'FOREST_START_LEAK=parent # a comment dotenv 8 keeps\n' },
          ],
          std: [{ out: 'Your back-office is live!' }],
        });
      } finally {
        delete process.env.FOREST_START_LEAK;
      }

      const [[command, args, options]] = startProcess.mock.calls;
      expect([command, args, options.cwd]).toStrictEqual(['npm', ['start'], 'x']);
      expect(inherited).toBeUndefined();
    });

    it("waits for the agent's schema push, not for a server to listen or a mount to start", async () => {
      expect.hasAssertions();
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] !== 'projects:create:sql') return;
        fs.mkdirSync('x');
        fs.writeFileSync('x/package.json', JSON.stringify({ scripts: { build: 'tsc' } }));
      });
      startProcess
        .mockReset()
        .mockReturnValue({ child: undefined, ready: Promise.resolve(), mute: () => {} });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x'],
        std: [{ out: 'Your back-office is live!' }],
      });

      const [[, , { ready }]] = startProcess.mock.calls;
      expect(ready.test('Schema was updated, sending new version')).toBe(true);
      // An app with nothing mounted prints this too: "live" must mean Forest answered.
      expect(ready.test('Listening on http://localhost:3310')).toBe(false);
      // Logged by the framework mounts before `start()` has run, so before it can fail.
      expect(ready.test('Successfully mounted on Express.js')).toBe(false);
    });

    it('refuses a --name whose directory exists, before creating any project', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);

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

    it('keeps the whole --db URL out of the error when create:sql fails', async () => {
      expect.hasAssertions();
      const db = 'postgres://host:5432/db?password=hunter2';
      // What the runner rejects with: it masks URL userinfo, never a query parameter.
      runStep.mockReset().mockImplementation(async (_, args) => {
        if (args[1] === 'projects:create:sql')
          throw new Error(`\`forest ${args.slice(1).join(' ')}\` exited with code 1`);
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'standalone', '--name', 'x', '--db', db],
        exitMessage:
          '`forest projects:create:sql x --databaseConnectionURL <redacted> -s public -l typescript -H http://localhost -P 3310` exited with code 1',
        std: [{ not: 'hunter2' }],
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
    it('stops before touching the Gemfile when no secret comes back, so the failure installs nothing', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
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
    it('reads both secrets from the printed output, including an auth secret that is not hex', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      // The human output of `projects:create:in-app`: FOREST_AUTH_SECRET is any string the user owns.
      runCapture.mockReset().mockResolvedValue({
        stdout:
          '  FOREST_ENV_SECRET=abc123\n  FOREST_AUTH_SECRET=myAuthSecret   (you own this one)\n',
        stderr: '',
      });

      await testCli({
        commandClass: StartCommand,
        commandArgs: ['--flow', 'inapp', '--stack', 'node', '--name', 'app'],
        files: [{ name: 'package.json', content: JSON.stringify({ name: 'app' }) }],
        std: [
          { out: 'FOREST_ENV_SECRET and FOREST_AUTH_SECRET written to .env' },
          { not: 'myAuthSecret' },
        ],
      });
    });

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

  describe('on Windows', () => {
    it('refuses before logging in, since every flow creates a project before its first spawn', async () => {
      expect.hasAssertions();
      runStep.mockReset().mockResolvedValue(undefined);
      const platform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'win32' });

      try {
        await testCli({
          commandClass: StartCommand,
          commandArgs: ['--flow', 'demo'],
          exitMessage:
            '`forest start` does not run on Windows yet. Use WSL, or follow https://docs.forest.app by hand.',
        });
      } finally {
        Object.defineProperty(process, 'platform', platform);
      }

      expect(runStep).not.toHaveBeenCalled();
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
